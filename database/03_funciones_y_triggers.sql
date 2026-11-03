-- =====================================================================
-- Script 03: Funciones y triggers (disparadores)
-- Proyecto: Hamburguesas y Pinchos Fercho (Equipo 1, D194 / B194)
--
-- Se ejecuta después del script 02, conectado a fercho_db.
--
-- ¿Qué es un trigger?
--   Es una función que PostgreSQL ejecuta AUTOMÁTICAMENTE cuando ocurre
--   un INSERT, UPDATE o DELETE sobre una tabla.
--     BEFORE -> se ejecuta ANTES del cambio; puede modificar o rechazar
--               la fila (RAISE EXCEPTION cancela toda la operación).
--     AFTER  -> se ejecuta DESPUÉS; sirve para actualizar otras tablas.
--   Dentro de la función:
--     NEW = la fila nueva (INSERT/UPDATE)   OLD = la fila anterior (UPDATE/DELETE)
--     TG_OP = 'INSERT', 'UPDATE' o 'DELETE'
--
-- Lenguaje: PL/pgSQL, el lenguaje procedural de PostgreSQL.
--
-- Se usa CREATE OR REPLACE (en funciones y triggers) para que este
-- script pueda ejecutarse de nuevo si se corrige algo, sin borrar datos.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Fecha de última modificación automática
-- ---------------------------------------------------------------------
-- Cada vez que se actualiza un producto o un pedido, se guarda la hora.
CREATE OR REPLACE FUNCTION fn_marcar_actualizado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;   -- en un BEFORE, se devuelve la fila (posiblemente modificada)
END;
$$;

CREATE OR REPLACE TRIGGER tg_productos_actualizado
    BEFORE UPDATE ON productos
    FOR EACH ROW EXECUTE FUNCTION fn_marcar_actualizado();

CREATE OR REPLACE TRIGGER tg_pedidos_actualizado
    BEFORE UPDATE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION fn_marcar_actualizado();


-- ---------------------------------------------------------------------
-- 2. Validar y completar cada línea del detalle del pedido
-- ---------------------------------------------------------------------
-- Reglas:
--   a) No se puede modificar el detalle de un pedido pagado o cerrado
--      (entregado o cancelado).
--   b) Solo se pueden pedir productos activos y disponibles.
--   c) Si no se indica el precio, se copia el precio actual del producto.
CREATE OR REPLACE FUNCTION fn_validar_detalle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_pedido  INTEGER;
    v_pagado_en  TIMESTAMPTZ;
    v_estado     VARCHAR(20);
    v_producto   productos%ROWTYPE;   -- variable con la misma forma que una fila de productos
BEGIN
    -- En un DELETE solo existe OLD; en INSERT/UPDATE existe NEW.
    IF TG_OP = 'DELETE' THEN
        v_id_pedido := OLD.id_pedido;
    ELSE
        v_id_pedido := NEW.id_pedido;
    END IF;

    -- a) Estado del pedido
    SELECT p.pagado_en, e.codigo
      INTO v_pagado_en, v_estado
      FROM pedidos p
      JOIN estados_pedido e ON e.id_estado = p.id_estado
     WHERE p.id_pedido = v_id_pedido;

    -- Si el pedido ya no existe es porque se está borrando completo
    -- (ON DELETE CASCADE); en ese caso se permite.
    IF FOUND THEN
        IF v_pagado_en IS NOT NULL THEN
            RAISE EXCEPTION 'El pedido % ya fue pagado; no se puede modificar su detalle.', v_id_pedido;
        END IF;
        IF v_estado IN ('entregado', 'cancelado') THEN
            RAISE EXCEPTION 'El pedido % está cerrado (%); no se puede modificar su detalle.', v_id_pedido, v_estado;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    -- b) Producto activo y disponible (solo al agregarlo o cambiarlo)
    IF TG_OP = 'INSERT' OR NEW.id_producto <> OLD.id_producto THEN
        SELECT * INTO v_producto FROM productos WHERE id_producto = NEW.id_producto;

        IF NOT v_producto.activo OR NOT v_producto.disponible THEN
            RAISE EXCEPTION 'El producto "%" no está disponible.', v_producto.nombre;
        END IF;

        -- c) Precio copiado del menú si no viene indicado
        IF NEW.precio_unitario IS NULL THEN
            NEW.precio_unitario := v_producto.precio;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tg_detalle_validar
    BEFORE INSERT OR UPDATE OR DELETE ON detalle_pedido
    FOR EACH ROW EXECUTE FUNCTION fn_validar_detalle();


-- ---------------------------------------------------------------------
-- 3. Recalcular el total del pedido
-- ---------------------------------------------------------------------
-- Cada vez que se agrega, cambia o elimina una línea del detalle, el
-- total del pedido se vuelve a calcular como la suma de los subtotales.
-- Así el total nunca queda desactualizado, sin importar desde dónde se
-- modifiquen los datos (la aplicación, pgAdmin o psql).
CREATE OR REPLACE FUNCTION fn_recalcular_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_id_pedido INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_id_pedido := OLD.id_pedido;
    ELSE
        v_id_pedido := NEW.id_pedido;
    END IF;

    UPDATE pedidos
       SET total = (SELECT COALESCE(SUM(subtotal), 0)   -- COALESCE: si no hay líneas, 0
                      FROM detalle_pedido
                     WHERE id_pedido = v_id_pedido)
     WHERE id_pedido = v_id_pedido;

    RETURN NULL;   -- en un AFTER el valor devuelto se ignora
END;
$$;

CREATE OR REPLACE TRIGGER tg_detalle_total
    AFTER INSERT OR UPDATE OR DELETE ON detalle_pedido
    FOR EACH ROW EXECUTE FUNCTION fn_recalcular_total();


-- ---------------------------------------------------------------------
-- 4. Reglas de negocio sobre el pedido (estado y pago)
-- ---------------------------------------------------------------------
-- Reglas:
--   a) Un pedido entregado o cancelado ya no cambia de estado.
--   b) Un pedido cancelado no se puede pagar.
--   c) Un pedido pagado no se puede cancelar ni "despagar".
--   d) No se puede pagar un pedido sin productos (total 0).
CREATE OR REPLACE FUNCTION fn_validar_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_anterior VARCHAR(20);
    v_estado_nuevo    VARCHAR(20);
BEGIN
    SELECT codigo INTO v_estado_anterior FROM estados_pedido WHERE id_estado = OLD.id_estado;
    SELECT codigo INTO v_estado_nuevo    FROM estados_pedido WHERE id_estado = NEW.id_estado;

    -- a)
    IF NEW.id_estado <> OLD.id_estado
       AND v_estado_anterior IN ('entregado', 'cancelado') THEN
        RAISE EXCEPTION 'El pedido % está % y ya no puede cambiar de estado.',
                        OLD.id_pedido, v_estado_anterior;
    END IF;

    -- c) (se revisa antes que b para dar el mensaje correcto)
    IF OLD.pagado_en IS NOT NULL AND v_estado_nuevo = 'cancelado' THEN
        RAISE EXCEPTION 'El pedido % ya fue pagado; no se puede cancelar.', OLD.id_pedido;
    END IF;

    -- b)
    IF NEW.pagado_en IS NOT NULL AND v_estado_nuevo = 'cancelado' THEN
        RAISE EXCEPTION 'El pedido % está cancelado; no se puede registrar el pago.', OLD.id_pedido;
    END IF;

    -- c) (continuación)
    IF OLD.pagado_en IS NOT NULL AND NEW.pagado_en IS NULL THEN
        RAISE EXCEPTION 'El pedido % ya fue pagado; el pago no se puede anular.', OLD.id_pedido;
    END IF;

    -- d)
    IF OLD.pagado_en IS NULL AND NEW.pagado_en IS NOT NULL AND NEW.total <= 0 THEN
        RAISE EXCEPTION 'El pedido % no tiene productos; no se puede pagar.', OLD.id_pedido;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tg_pedidos_validar
    BEFORE UPDATE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION fn_validar_pedido();


-- ---------------------------------------------------------------------
-- 5. Historial de estados
-- ---------------------------------------------------------------------
-- Guarda una fila en historial_estados cuando se crea un pedido y cada
-- vez que cambia de estado. "UPDATE OF id_estado" hace que el trigger
-- solo se dispare si esa columna aparece en el UPDATE.
CREATE OR REPLACE FUNCTION fn_registrar_historial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.id_estado IS DISTINCT FROM OLD.id_estado THEN
        INSERT INTO historial_estados (id_pedido, id_estado)
        VALUES (NEW.id_pedido, NEW.id_estado);
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER tg_pedidos_historial
    AFTER INSERT OR UPDATE OF id_estado ON pedidos
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_historial();
