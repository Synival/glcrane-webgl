/* shader.vert
 * -----------
 * Vertex shader used for all rendering. */

precision highp float;

attribute vec3 aPosition, aNormal;
attribute vec2 aTexcoord0;
uniform mat4 uMatrixModelView;
uniform mat4 uMatrixProjection;
uniform mat3 uMatrixNormal;
uniform float uLightIntensity;

varying vec3 vNormal;
varying vec2 vTexcoord0;
varying float vLight;

const vec3 light = vec3 (0.766, 0.287, 0.574);

void main (void) {
   float i     = uLightIntensity * 0.50;
   vec3 n      = normalize (uMatrixNormal * aNormal);
   vLight      = clamp (dot (n, light) * i + (1.00 - i), 0.00, 1.00);
   vTexcoord0  = aTexcoord0;
   gl_Position = uMatrixProjection * uMatrixModelView * vec4 (aPosition, 1.00);
}
