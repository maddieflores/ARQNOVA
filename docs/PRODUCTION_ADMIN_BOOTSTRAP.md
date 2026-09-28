# Bootstrap controlado del administrador de producción

Este procedimiento reutiliza el seed idempotente existente. Crea los roles `ADMINISTRADOR`, `ANFITRION` y `COLABORADOR` y crea el administrador solamente si su email todavía no existe. No actualiza contraseñas ni cuentas existentes.

## Requisitos

- Haber ejecutado `npm run prisma:migrate:deploy` contra RDS.
- Ejecutar desde la EC2 mediante Session Manager, dentro del directorio `backend` del release de `production`.
- Tener disponibles las variables normales del backend, incluida `DATABASE_URL`.
- Guardar nombre, email y contraseña del administrador en parámetros cifrados. No escribir sus valores en Git ni pasarlos como argumentos del comando.

## Ejecución única

En una sesión de shell de Session Manager, desactivar el trazado antes de cargar secretos. Los nombres de parámetros siguientes son placeholders y deben reemplazarse por los creados para ARQNOVA:

```bash
set +x
trap 'unset ADMIN_NAME ADMIN_EMAIL ADMIN_PASSWORD ADMIN_BOOTSTRAP_ENABLED' EXIT
export NODE_ENV=production
export ADMIN_BOOTSTRAP_ENABLED=true
export ADMIN_NAME="$(aws ssm get-parameter --name /arqnova/production/admin-name --with-decryption --query Parameter.Value --output text)"
export ADMIN_EMAIL="$(aws ssm get-parameter --name /arqnova/production/admin-email --with-decryption --query Parameter.Value --output text)"
export ADMIN_PASSWORD="$(aws ssm get-parameter --name /arqnova/production/admin-password --with-decryption --query Parameter.Value --output text)"
npm run prisma:bootstrap-admin
unset ADMIN_NAME ADMIN_EMAIL ADMIN_PASSWORD ADMIN_BOOTSTRAP_ENABLED
trap - EXIT
```

El comando termina correctamente solo después de que la transacción haya verificado los tres roles y una cuenta activa con rol `ADMINISTRADOR`. La salida muestra la cantidad de roles y el ID del administrador, nunca la contraseña ni su hash.

Una segunda ejecución con el mismo email es idempotente: conserva la cuenta y su contraseña actuales. Si el email pertenece a una cuenta inactiva o con otro rol, el proceso falla sin modificarla.

## Verificación

- Confirmar que la salida indique `3 roles` y un ID de administrador.
- Iniciar la API sin `ADMIN_BOOTSTRAP_ENABLED`.
- Verificar el login por el endpoint existente usando las credenciales introducidas de forma segura.
- Mantener `ADMIN_BOOTSTRAP_ENABLED` ausente o en `false` en el servicio permanente.
