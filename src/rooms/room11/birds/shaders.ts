/**
 * Bandada GPGPU, portada del ejemplo webgl_gpgpu_birds de three.js.
 *
 * Cambios respecto al original, todos para que CRUCEN DE IZQUIERDA A DERECHA
 * en vez de orbitar un punto fijo:
 *
 *  1. La atraccion al centro deja de actuar en X (dir.x = 0). Si no, la
 *     bandada volveria siempre al mismo sitio y no avanzaria.
 *  2. Se anade una deriva constante hacia +X, a la que la velocidad tiende
 *     suavemente. Va DENTRO del shader de velocidad y no como traslacion del
 *     grupo, porque la orientacion de cada pajaro se deduce de su velocidad:
 *     moviendo el grupo por fuera volarian de lado.
 *  3. Sin envoltura: cada pasada es puntual. Nacen fuera de cuadro por la
 *     izquierda, cruzan y se van para no volver. El fundido de los bordes
 *     queda como seguro por si alguna se queda rezagada.
 *  4. Fuera el depredador del raton: aqui el puntero esta capturado.
 */

export const positionFrag = /* glsl */ `
uniform float time;
uniform float delta;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 tmpPos = texture2D( texturePosition, uv );
  vec3 position = tmpPos.xyz;
  vec3 velocity = texture2D( textureVelocity, uv ).xyz;

  float phase = tmpPos.w;

  phase = mod( ( phase + delta +
    length( velocity.xz ) * delta * 3. +
    max( velocity.y, 0.0 ) * delta * 6. ), 62.83 );

  gl_FragColor = vec4( position + velocity * delta * 15., phase );
}
`;

export const velocityFrag = /* glsl */ `
uniform float time;
uniform float delta;
uniform float separationDistance;
uniform float alignmentDistance;
uniform float cohesionDistance;
uniform float driftSpeed;

const float width = resolution.x;
const float height = resolution.y;

const float PI = 3.141592653589793;
const float PI_2 = PI * 2.0;

const float SPEED_LIMIT = 9.0;

void main() {
  float zoneRadius = separationDistance + alignmentDistance + cohesionDistance;
  float separationThresh = separationDistance / zoneRadius;
  float alignmentThresh = ( separationDistance + alignmentDistance ) / zoneRadius;
  float zoneRadiusSquared = zoneRadius * zoneRadius;

  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 birdPosition, birdVelocity;

  vec3 selfPosition = texture2D( texturePosition, uv ).xyz;
  vec3 selfVelocity = texture2D( textureVelocity, uv ).xyz;

  float dist;
  vec3 dir;
  float distSquared;
  float f;
  float percent;

  vec3 velocity = selfVelocity;

  // Cohesion con el centro SOLO en Y/Z: en X van a la deriva.
  vec3 central = vec3( 0.0, 0.0, 0.0 );
  dir = selfPosition - central;
  dir.x = 0.0;
  dist = length( dir );
  if ( dist > 0.0001 ) {
    dir.y *= 2.5;
    velocity -= normalize( dir ) * delta * 5.;
  }

  for ( float y = 0.0; y < height; y++ ) {
    for ( float x = 0.0; x < width; x++ ) {

      vec2 ref = vec2( x + 0.5, y + 0.5 ) / resolution.xy;
      birdPosition = texture2D( texturePosition, ref ).xyz;

      dir = birdPosition - selfPosition;
      dist = length( dir );

      if ( dist < 0.0001 ) continue;

      distSquared = dist * dist;
      if ( distSquared > zoneRadiusSquared ) continue;

      percent = distSquared / zoneRadiusSquared;

      if ( percent < separationThresh ) {
        // separacion
        f = ( separationThresh / percent - 1.0 ) * delta;
        velocity -= normalize( dir ) * f;

      } else if ( percent < alignmentThresh ) {
        // alineacion
        float threshDelta = alignmentThresh - separationThresh;
        float adjustedPercent = ( percent - separationThresh ) / threshDelta;
        birdVelocity = texture2D( textureVelocity, ref ).xyz;
        f = ( 0.5 - cos( adjustedPercent * PI_2 ) * 0.5 + 0.5 ) * delta;
        velocity += normalize( birdVelocity ) * f;

      } else {
        // cohesion
        float threshDelta = 1.0 - alignmentThresh;
        float adjustedPercent = threshDelta == 0.0
          ? 1.0
          : ( percent - alignmentThresh ) / threshDelta;
        f = ( 0.5 - ( cos( adjustedPercent * PI_2 ) * -0.5 + 0.5 ) ) * delta;
        velocity += normalize( dir ) * f;
      }
    }
  }

  // deriva constante de izquierda a derecha
  velocity.x += ( driftSpeed - velocity.x ) * min( 1.0, delta * 0.9 );

  if ( length( velocity ) > SPEED_LIMIT ) {
    velocity = normalize( velocity ) * SPEED_LIMIT;
  }

  gl_FragColor = vec4( velocity, 1.0 );
}
`;

export const birdVert = /* glsl */ `
attribute vec2 reference;
attribute float birdVertex;
attribute vec3 birdColor;

uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;

varying float vShade;
varying float vFade;

void main() {
  vec4 tmpPos = texture2D( texturePosition, reference );
  vec3 pos = tmpPos.xyz;
  vec3 velocity = normalize( texture2D( textureVelocity, reference ).xyz );

  vec3 newPosition = position;

  if ( birdVertex == 4.0 || birdVertex == 7.0 ) {
    newPosition.y = sin( tmpPos.w ) * 5.;   // aleteo
  }

  velocity.z *= -1.;
  float xz = length( velocity.xz );
  float x = sqrt( 1. - velocity.y * velocity.y );

  float cosry = velocity.x / xz;
  float sinry = velocity.z / xz;
  float cosrz = x;
  float sinrz = velocity.y;

  mat3 maty = mat3( cosry, 0, -sinry, 0, 1, 0, sinry, 0, cosry );
  mat3 matz = mat3( cosrz, sinrz, 0, -sinrz, cosrz, 0, 0, 0, 1 );

  newPosition = maty * matz * newPosition;
  newPosition += pos;

  // se apagan al alejarse mucho: seguro contra rezagadas en cuadro
  vFade = 1.0 - smoothstep( FADE_X * 0.75, FADE_X, abs( pos.x ) );

  vShade = birdColor.x;

  // modelMatrix aqui: coloca y escala la bandada entera desde el grupo de R3F
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( newPosition, 1.0 );
}
`;

export const birdFrag = /* glsl */ `
uniform vec3 uBird;
uniform vec3 uSky;

varying float vShade;
varying float vFade;

void main() {
  vec3 c = uBird * ( 0.72 + 0.45 * vShade );
  c = mix( uSky, c, vFade );
  gl_FragColor = vec4( c, 1.0 );
}
`;
