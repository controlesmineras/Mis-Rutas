# Mis rutas

**[Abrir Mis rutas](https://controlesmineras.github.io/Mis-Rutas/)**

Aplicación independiente de SK-Web, Plaza Blending y el Drive de SK. Los datos se guardan en el dispositivo y en el Google Drive que conecte cada usuario.

## Conectar una cuenta y recuperar sus viajes

Toca **Conectar con Google**. Google abre su selector de cuentas y permite iniciar sesión si no hay ninguna abierta en ese dispositivo. El correo y la contraseña se introducen exclusivamente en la ventana oficial de Google. La app no recibe ni almacena contraseñas y mantiene el permiso de acceso temporal solo en memoria.

Después de autorizar, la app recupera los itinerarios de esa cuenta de Drive. Al abrir Mis viajes en otro dispositivo, conecta la misma cuenta para recuperar la última información sincronizada. Iniciar sesión requiere internet; después puedes consultar y editar la libreta local sin conexión. Los cambios pendientes se envían al recuperar internet si el permiso sigue vigente. Si venció, vuelve a conectar Google.

Cada cuenta tiene una libreta local separada. **Cambiar cuenta de Google** recupera la libreta de la otra persona sin subirle las rutas de la cuenta anterior. **Cerrar sesión de Mis viajes** vuelve a las rutas sin cuenta del dispositivo; no cierra la sesión de Google del navegador ni borra las copias de Drive.

Si existen rutas locales sin cuenta al conectar, puedes añadirlas a tu cuenta o recuperar solo Drive. En este último caso se conservan aparte y vuelven a aparecer al cerrar sesión de Mis viajes. Las libretas de versiones anteriores se migran conservando sus datos.

## Activación de Google para quien administra la app

La configuración se realiza una sola vez para la aplicación, no para cada usuario o dispositivo:

1. Habilita Google Drive API en el proyecto de Google Cloud de Mis viajes.
2. Configura la pantalla de consentimiento y crea un cliente OAuth de tipo **Aplicación web**. Autoriza el origen `https://controlesmineras.github.io` (sin la ruta `/Mis-Rutas/`). Si el proyecto está en pruebas, añade las cuentas que podrán probarlo como usuarios de prueba.
3. Publica el ID público de cliente, terminado en `.apps.googleusercontent.com`, en `public/config.json`, en la propiedad `googleClientId`. Ejecuta `npm run build` y publica también `dist/config.json`, como parte de `dist/`.

Se solicita únicamente `drive.appdata`, para las copias privadas de esta aplicación. Todos los dispositivos deben usar el mismo proyecto de Google para recuperar las mismas copias. No publiques secretos de cliente ni tokens. El repositorio se entrega con `googleClientId` vacío: mientras no se proporcione un cliente real autorizado, Google no estará activado.

Se conserva el ajuste local anterior en **Configuración de la aplicación → Configuración avanzada** por compatibilidad. La configuración publicada tiene prioridad y evita pedir el ID en cada dispositivo. El ajuste local no se comparte entre dispositivos.

Descargar copia e Importar copia permiten trasladar datos entre dispositivos. Con Google conectado, los cambios se sincronizan después de guardar; además se consulta Drive cada dos minutos mientras la app esté abierta y el acceso siga vigente. Las copias registran las versiones ya incorporadas para no restaurar itinerarios antiguos repetidos en un dispositivo nuevo. Las modificaciones simultáneas incompatibles se conservan como otra copia.

Instala con `npm ci`, valida con `npm run test:drive` y `npm run test:contacts`, y compila con `npm run build`. Las pruebas de Google/Drive simulan las respuestas y no sustituyen una comprobación con el cliente OAuth real. GitHub Actions publica `dist/`.

