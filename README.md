# Mis rutas — versión independiente

Esta versión es una PWA estática: no utiliza servidores, cuentas ni bases de datos de ChatGPT Sites. Puede publicarse en un servidor HTTPS, GitHub Pages o integrarse más adelante en una aplicación Android. El proyecto todavía no está publicado fuera de Sites y Google Drive está pendiente de configuración.

## Funciones

- Rutas completas por nombre y tramos con origen y destino.
- RUTA PRINCIPAL y RUTA ALTERNA; principal por defecto.
- Hora, empresa, contacto, descripción, tiempo de viaje y evaluaciones.
- Guardado local en IndexedDB; instalación y consulta sin internet tras la primera carga completa.
- Descargar e importar copias JSON.
- Sincronización con Google Drive al conectar, manualmente y cada dos minutos mientras la app esté abierta y el acceso a Google siga vigente.
- Copias nuevas en Drive, sin sobrescribir ni eliminar copias anteriores.
- Recuperación al conectar otro dispositivo con la misma cuenta y el mismo cliente OAuth.
- Cambios simultáneos diferentes se conservan en una ruta adicional «(otra copia)» para revisión.

## Activar Google Drive (configuración del propietario)

1. Crear o seleccionar un proyecto en Google Cloud y habilitar Google Drive API.
2. Configurar Google Auth Platform: nombre, contacto, audiencia y permisos. El permiso utilizado es `https://www.googleapis.com/auth/drive.appdata`.
3. Crear un cliente OAuth de tipo «Aplicación web» y agregar el origen HTTPS definitivo de la app como origen JavaScript autorizado. Un origen lleva protocolo y dominio, sin rutas. Para desarrollo puede autorizarse también el origen localhost correspondiente.
4. Escribir el ID público del cliente en `public/config.json`: `{"googleClientId":"ID.apps.googleusercontent.com"}`. No se necesita ni se incluye un secreto de cliente en el navegador.
5. Si el proyecto de Google está en modo de pruebas, registrar las cuentas de prueba que usarán la app. Preparar la configuración de producción de Google antes de distribuirla a otras personas.
6. Compilar, publicar el contenido de `dist/` y comprobar Conectar Drive → autorización → guardado → recuperación real en otro dispositivo.

La carpeta de datos de la aplicación en Drive no aparece como una carpeta normal en «Mi unidad». Solo esta app accede a ella. Google permite al usuario eliminar esos datos; por eso también existe Descargar copia.

Documentación oficial:
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/drive/api/guides/appdata

## Ejecutar y publicar

Requiere Node.js 22.13 o posterior.

```sh
npm install
npm run dev
```

```sh
npm run build
```

Publicar exclusivamente el contenido de `dist/`. No publicar archivos personales de respaldo. Para una instalación PWA se requiere HTTPS (o localhost durante desarrollo). La app no funciona abriendo `index.html` directamente con `file://`.

## Trasladar los datos actuales

La copia `privado/mis-rutas-datos-actuales.json` contiene los registros recuperados de la versión anterior al preparar este paquete. En la nueva app pulsar «Importar copia» y elegir ese archivo. Importar conserva también datos locales que ya existan. Luego conectar Drive y verificar la copia. No publicar este archivo en un repositorio público ni colocarlo dentro de `dist/`.

El almacenamiento de la nueva dirección web es independiente del de Sites. Por eso es necesario importar o recuperar desde Drive. No se ha borrado ni modificado la base de datos anterior.

## Comprobaciones realizadas y pendientes

Completados: TypeScript, compilación estática, preparación del caché sin conexión, pruebas de recuperación y combinación de cambios simultáneos, repetición sin duplicar las copias de conflicto.

Pendientes: autorización real con Google, carga/recuperación de Drive entre dispositivos, prueba de instalación y apertura sin internet en iPhone/Android, publicación fuera de Sites. No hay un cliente OAuth configurado todavía.

Los tokens de Google quedan en memoria, no en archivos ni en almacenamiento permanente. Al vencer o cerrar la aplicación será necesario volver a conectar. La sincronización no corre si la aplicación está cerrada. Una APK necesitará integrar la autorización nativa de Google y su configuración Android; este paquete no es un APK ni una publicación de Play Store.

## GitHub Pages

El archivo `.github/workflows/pages.yml` publica los archivos ya compilados de `dist/` cuando hay cambios en `main`. En Settings → Pages, elegir GitHub Actions como origen. Subir el código y `dist/`, conservando los archivos de `privado/` fuera del repositorio. No subir datos personales. La conexión con Drive debe configurarse para el origen `https://controlesmineras.github.io` antes de generar y subir la nueva compilación.
