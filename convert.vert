/* convert.vert
 * ------------
 * Used when converting RGB -> XYV (x, y, value). */

precision highp float;

attribute vec4 aPosition;
attribute vec2 aTexcoord0;

uniform mat4 uMatrixModelView;
uniform mat4 uMatrixProjection;

varying float vValue;
varying vec2 vTexcoord0;

void main (void) {
   gl_Position = uMatrixProjection * uMatrixModelView *
      vec4 (aPosition.xy, 0.00, 1.00);
   vValue = aPosition.w;
   vTexcoord0 = aTexcoord0;
}
