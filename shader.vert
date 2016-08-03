/* shader.vert
 * -----------
 * Vertex shader used for all rendering. */

precision mediump float;

attribute vec3 aPosition, aNormal;
uniform mat4 uMatrixModelView;
uniform mat4 uMatrixProjection;
uniform mat3 uMatrixNormal;

varying vec3 vNormal;
varying float vLight;

const vec3 light = normalize (vec3 (2.00, 0.75, -1.50));

void main (void) {
   vec3 n = normalize (uMatrixNormal * aNormal);
   vLight = clamp (dot (n, light) * 0.50 + 0.50, 0.00, 1.00);
   gl_Position = uMatrixProjection * uMatrixModelView * vec4 (aPosition, 1.00);
}
