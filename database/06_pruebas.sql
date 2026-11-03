-- =====================================================================
-- Script 06: Pruebas de las reglas de la base de datos
-- Proyecto: Hamburguesas y Pinchos Fercho (Equipo 1, D194 / B194)
--
-- Comprueba que los triggers y restricciones funcionan. Todo se hace
-- dentro de una TRANSACCIÓN que termina en ROLLBACK, así que NO deja
-- datos guardados: la base queda igual que antes de ejecutarlo.
--
-- Cada prueba imprime "OK" o "FALLA" con RAISE NOTICE.
-- Las pruebas de errores usan BEGIN ... EXCEPTION ... END: si la
-- operación es rechazada (lo esperado), se captura el error y se
-- informa OK.
-- =====================================================================

BEGIN;   -- inicia la transacción

DO $$
DECLARE
    v_mesero  INTEGER := (SELECT id_usuario FROM usuarios WHERE usuario = 'mesero1');
    v_pedido  INTEGER;
    v_total   NUMERIC;
    v_hist    INTEGER;
BEGIN
    -- Prueba 1: crear un pedido en la Mesa 3 y agregar productos.
    INSERT INTO pedidos (id_mesa, id_mesero, observaciones)
    VALUES ((SELECT id_mesa FROM mesas WHERE numero = 3), v_mesero, 'Prueba')
    RETURNING id_pedido INTO v_pedido;

    INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, observaciones) VALUES
        (v_pedido, (SELECT id_producto FROM productos WHERE nombre = 'Hamburguesa doble'), 2, 'sin cebolla'),
        (v_pedido, (SELECT id_producto FROM productos WHERE nombre = 'Gaseosa 400 ml'),    2, NULL);

    -- Prueba 2: el total se calculó solo: 2 x 22000 + 2 x 4000 = 52000
    SELECT total INTO v_total FROM pedidos WHERE id_pedido = v_pedido;
    RAISE NOTICE '% Total calculado por trigger: % (esperado 52000)',
        CASE WHEN v_total = 52000 THEN 'OK   ' ELSE 'FALLA' END, v_total;

    -- Prueba 3: no se puede pedir un producto agotado.
    UPDATE productos SET disponible = FALSE WHERE nombre = 'Jugo natural';
    BEGIN
        INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad)
        VALUES (v_pedido, (SELECT id_producto FROM productos WHERE nombre = 'Jugo natural'), 1);
        RAISE NOTICE 'FALLA Se permitió pedir un producto agotado';
    EXCEPTION WHEN raise_exception THEN
        RAISE NOTICE 'OK    Producto agotado rechazado: %', SQLERRM;
    END;

    -- Prueba 4: cambios de estado quedan en el historial.
    UPDATE pedidos SET id_estado = (SELECT id_estado FROM estados_pedido WHERE codigo = 'en_preparacion') WHERE id_pedido = v_pedido;
    UPDATE pedidos SET id_estado = (SELECT id_estado FROM estados_pedido WHERE codigo = 'listo')          WHERE id_pedido = v_pedido;
    SELECT COUNT(*) INTO v_hist FROM historial_estados WHERE id_pedido = v_pedido;
    RAISE NOTICE '% Historial de estados: % registros (esperado 3)',
        CASE WHEN v_hist = 3 THEN 'OK   ' ELSE 'FALLA' END, v_hist;

    -- Prueba 5: el pedido aparece en la pantalla de cocina.
    RAISE NOTICE '% Pedido visible en v_pedidos_cocina',
        CASE WHEN EXISTS (SELECT 1 FROM v_pedidos_cocina WHERE id_pedido = v_pedido) THEN 'OK   ' ELSE 'FALLA' END;

    -- Prueba 6: pago incompleto (fecha sin forma de pago) es rechazado por CHECK.
    BEGIN
        UPDATE pedidos SET pagado_en = now() WHERE id_pedido = v_pedido;
        RAISE NOTICE 'FALLA Se permitió un pago sin forma de pago';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK    Pago sin forma de pago rechazado (CHECK ck_pedidos_pago_completo)';
    END;

    -- Prueba 7: registrar el pago -> se convierte en venta.
    UPDATE pedidos
       SET pagado_en = now(),
           id_forma_pago = (SELECT id_forma_pago FROM formas_pago WHERE nombre = 'Efectivo')
     WHERE id_pedido = v_pedido;
    RAISE NOTICE '% Pedido pagado aparece en v_ventas',
        CASE WHEN EXISTS (SELECT 1 FROM v_ventas WHERE id_pedido = v_pedido) THEN 'OK   ' ELSE 'FALLA' END;

    -- Prueba 8: un pedido pagado no se puede modificar.
    BEGIN
        UPDATE detalle_pedido SET cantidad = 5 WHERE id_pedido = v_pedido;
        RAISE NOTICE 'FALLA Se modificó un pedido pagado';
    EXCEPTION WHEN raise_exception THEN
        RAISE NOTICE 'OK    Modificar pedido pagado rechazado: %', SQLERRM;
    END;

    -- Prueba 9: un pedido pagado no se puede cancelar.
    BEGIN
        UPDATE pedidos SET id_estado = (SELECT id_estado FROM estados_pedido WHERE codigo = 'cancelado') WHERE id_pedido = v_pedido;
        RAISE NOTICE 'FALLA Se canceló un pedido pagado';
    EXCEPTION WHEN raise_exception THEN
        RAISE NOTICE 'OK    Cancelar pedido pagado rechazado: %', SQLERRM;
    END;

    -- Prueba 10: precio negativo rechazado por CHECK.
    BEGIN
        UPDATE productos SET precio = -100 WHERE nombre = 'Agua 600 ml';
        RAISE NOTICE 'FALLA Se permitió un precio negativo';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'OK    Precio negativo rechazado (CHECK ck_productos_precio)';
    END;

    -- Prueba 11: la contraseña de prueba coincide con su hash bcrypt.
    RAISE NOTICE '% Contraseña de admin verificada con crypt()',
        CASE WHEN EXISTS (SELECT 1 FROM usuarios
                           WHERE usuario = 'admin'
                             AND contrasena_hash = crypt('Admin2026*', contrasena_hash))
             THEN 'OK   ' ELSE 'FALLA' END;

    -- Prueba 12: la función de ventas por rango encuentra la venta de hoy.
    RAISE NOTICE '% fn_ventas_por_rango(hoy, hoy) devuelve: %',
        CASE WHEN (SELECT total_vendido FROM fn_ventas_por_rango(current_date, current_date)
                    WHERE forma_pago = 'Efectivo') = 52000 THEN 'OK   ' ELSE 'FALLA' END,
        (SELECT string_agg(forma_pago || ' = ' || total_vendido, ', ')
           FROM fn_ventas_por_rango(current_date, current_date));
END;
$$;

ROLLBACK;   -- deshace todo: la base queda como estaba
