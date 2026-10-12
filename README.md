# DJ Studio

Sala 3D de 10 × 10 m que corre en el navegador: tarima con cabina DJ, luces de fiesta y 10 personajes personalizables (4 o 6 en la sala). Todos los que abren la página entran a la misma sala en línea.

**Jugar:** https://fr3d-ai.github.io/Dj-Studio/

## Tocar en vivo con Rekordbox
1. Abre Rekordbox y pon música.
2. En la página toca **Transmitir a la sala**.
3. Elige **Pantalla completa**, activa **Compartir audio del sistema** y toca **Compartir**.

Requiere Chrome o Edge. En Mac: Chrome 141+ y macOS 14.2+.

## Cómo funciona
- Todo el juego está en `index.html` (Three.js desde CDN).
- La sala en línea usa conexión directa entre navegadores (WebRTC), con Trystero 0.25.4 incluido en `vendor/`.
- Cada oyente analiza el audio que recibe para bailar en sincronía.
- Se publica con GitHub Pages desde la rama `main`.

## Créditos
- Modelo de **Nika** (`models/nika.glb`): basado en [«Teal-Haired Anime Girl»](https://sketchfab.com/3d-models/teal-haired-anime-girl-png-to-stl-supavoxel-aec3ed6d87d24586b17ce3d1b9b9c82b) de Zara Petrov, licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Cambios: pelo recoloreado, malla reducida de 647 mil a 45 mil triángulos, textura horneada de nuevo y esqueleto de 19 huesos con pesos propios.
