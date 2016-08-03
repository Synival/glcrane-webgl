// DOM elements to be linked in window.onload().
var domCanvas, domObject, domVertex, domFragment, domOuter, domErrors;

// Generic object-loading.
var objectLoadCount, objectLoadTotal, objectLoadQueue = [];
var errorText;

// 3D models.
var modelCrane;

// WebGL context, shaders, attributes, matrices, etc.
var gl;
var shaderVertex, shaderFragment, shaderProgram;
var matrixProjection = mat4.create ();
var matrixModelView  = mat4.create ();
var matrixNormal     = mat3.create ();

// Animation and frame data.
var frameLast    = 0.00;
var frameCurrent = 0.00;
var frameT       = 0.00;

// Our program starts here.
window.onload = function() {
   // Now our DOM is ready, Link elements to variables.
   domCanvas   = document.getElementById ("canvas");
   domObject   = document.getElementById ("object");
   domVertex   = document.getElementById ("vertex");
   domFragment = document.getElementById ("fragment");
   domOuter    = document.getElementById ("outer");
   domErrors   = document.getElementById ("errors");

   // Initialize canvas size.
   window.onresize = windowResize;
   windowResize ();

   // Load our objects.
   objectQueue (domObject,   "crane.obj");
   objectQueue (domVertex,   "shader.vert");
   objectQueue (domFragment, "shader.frag");
   objectLoad ();
}

function objectQueue (object, url) {
   // Add to our list of objects to load.
   objectLoadQueue.push ({ object: object, url: url });
}

function objectLoad () {
   // Keep track of how many objects we are to load.
   objectLoadTotal = objectLoadQueue.length;
   objectLoadCount = 0;

   // Send ajax requests to load all objects via jQuery.
   for (var i = 0; i < objectLoadTotal; i++) {
      var o = objectLoadQueue[i];
      $(o.object).load (o.url, null, objectLoadCallback (o.url));
   }
}

function windowResize () {
   // Send resize elements to document elements.
   canvasResize ();
}

function canvasResize () {
   // Resize canvas to element dimensions.
   domCanvas.width  = domCanvas.clientWidth;
   domCanvas.height = domCanvas.clientHeight;

   // Make sure our WebGL context is the proper size.
   if (gl) {
      gl.viewportWidth  = canvas.width;
      gl.viewportHeight = canvas.height;
      glInitScreen ();
   }
}

function objectLoadCallback (url) {
   // Encapsulate 'url' into our callback.
   return function (responseText, textStatus, xhr) {
      // Add to our error canvas if it didn't load.
      if (textStatus != "success") {
         errorAddText ("Couldn't load '" + url + "'");
         return;
      }

      // Increase loaded object count. If we reached the total, finish.
      objectLoadCount++;
      if (objectLoadCount == objectLoadTotal)
         objectsDone ();
   }
}

function objectsDone () {
   // Intialize WebGL.
   glInit (domCanvas);
}

function glInit (canvas) {
   // Load a WebGL context.
   try {
      gl = canvas.getContext ("experimental-webgl");
      gl.viewportWidth  = canvas.width;
      gl.viewportHeight = canvas.height;
   }
   catch (e) {
      if (!gl)
         errorAddText ("Couldn't load WebGL.");
      return;
   }

   // Load our shaders.
   try {
      shaderVertex   = glLoadShader (gl.VERTEX_SHADER,
         domVertex.innerHTML);
      shaderFragment = glLoadShader (gl.FRAGMENT_SHADER,
         domFragment.innerHTML);
      shaderProgram  = glCreateProgram (
         [shaderVertex, shaderFragment]);
   }
   catch (e) {
      errorAddText (e.toString ());
      return;
   }

   // Load our crane object.
   try {
      modelCrane = new OBJ.Mesh (domObject.innerHTML);
      if (modelCrane)
         OBJ.initMeshBuffers (gl, modelCrane);
   }
   catch (e) {
      errorAddText (e.toString ());
   }

   // Draw everything back a bit, rotated downward 30 degrees.
   mat4.identity (matrixModelView);
   var v = vec3.create ();
   vec3.set (v, 0.00, 0.00, -7.50);
   mat4.translate (matrixModelView, matrixModelView, v);
   vec3.set (v, 1.00, 0.00, 0.00);
   mat4.rotate (matrixModelView, matrixModelView, 30.00 / 180.00 * Math.PI, v);

   // Make sure our normals are adjusted properly.
   glUpdateNormalMatrix ();

   // Everything worked!  Activate our screen.
   glInitScreen ();
   glNextFrame (0.00);
}

function glNextFrame (t) {
   // Keep track of our frame time.
   frameLast    = frameCurrent;
   frameCurrent = t;
   frameT       = (frameCurrent - frameLast) / 1000.00;

   // Slowly rotate.
   var vec = vec3.create ();
   vec3.set (vec, 0.00, 1.00, 0.00);
   mat4.rotate (matrixModelView, matrixModelView,
      (45.00 / 180.00) * frameT * Math.PI, vec);
   glUpdateNormalMatrix ();

   // Redraw our scene.
   glDrawScene ();
   requestAnimationFrame (glNextFrame);
}

function glInitScreen () {
   // Make sure it's using the proper size.
   gl.viewport (0, 0, gl.viewportWidth, gl.viewportHeight);

   // Proper render state.
   gl.enable (gl.DEPTH_TEST);

   // Render at a 45 degree angle.
   mat4.perspective (matrixProjection, 45,
      gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);
}

function glUpdateNormalMatrix() {
   // Math!
   mat3.fromMat4  (matrixNormal, matrixModelView);
   mat3.invert    (matrixNormal, matrixNormal);
   mat3.transpose (matrixNormal, matrixNormal);
}

function glCheckError () {
   var err = gl.getError ();
   if (err != gl.NO_ERROR)
      alert ("Error!");
}

function glSetUniforms () {
   // Set our matrices.
   gl.uniformMatrix4fv (shaderProgram.uMatrixProjection, false,
      matrixProjection);
   gl.uniformMatrix4fv (shaderProgram.uMatrixModelView, false,
      matrixModelView);
   gl.uniformMatrix3fv (shaderProgram.uMatrixNormal, false,
      matrixNormal);
   glCheckError ();
}

function glDrawScene () {
   // Black screen.
   gl.clearColor (0.00, 0.00, 0.00, 1.00);
   gl.clear (gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

   // Set our matrices.
   glSetUniforms ();

   // Use our crane object.
   var obj = modelCrane;

   // Bind vertex positions.
   gl.bindBuffer (gl.ARRAY_BUFFER, obj.vertexBuffer);
   gl.vertexAttribPointer (shaderProgram.aPosition,
      obj.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

   // Bind vertex normals.
   gl.bindBuffer (gl.ARRAY_BUFFER, obj.normalBuffer);
   gl.vertexAttribPointer (shaderProgram.aNormal,
      obj.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);

   // Draw!
   gl.bindBuffer (gl.ELEMENT_ARRAY_BUFFER, obj.indexBuffer);
   gl.drawElements (gl.TRIANGLES, obj.indexBuffer.numItems,
      gl.UNSIGNED_SHORT, 0);
}

function glLoadShader (type, source) {
   // Attempt to compile our shader.
   var id = gl.createShader (type);
   gl.shaderSource (id, source);
   gl.compileShader (id);

   // Complain if the shader is not complete.
   if (!gl.getShaderParameter (id, gl.COMPILE_STATUS)) {
      var log = removeTrailing (gl.getShaderInfoLog (id));
      throw gl.getShaderInfoLog (id);
   }

   // Return our complete shader.
   return id;
}

function glCreateProgram (shaders) {
   // Create the program object and attach everything in shaders[].
   var id = gl.createProgram ();
   for (var i = 0; i < shaders.length; i++)
      gl.attachShader (id, shaders[i]);

   // Does this link properly?
   gl.linkProgram (id);
   if (!gl.getProgramParameter (id, gl.LINK_STATUS))
      throw new String("Couldn't link program");

   // Get and enable vertex attributes.
   gl.useProgram (id);
   id.aPosition = gl.getAttribLocation (id, "aPosition");
   id.aNormal   = gl.getAttribLocation (id, "aNormal");
   gl.enableVertexAttribArray (id.aPosition);
   gl.enableVertexAttribArray (id.aNormal);

   // Get uniform locations.
   id.uMatrixProjection = gl.getUniformLocation (id, "uMatrixProjection");
   id.uMatrixModelView  = gl.getUniformLocation (id, "uMatrixModelView");
   id.uMatrixNormal     = gl.getUniformLocation (id, "uMatrixNormal");

   // Return our new object handle.
   return id;
}

function errorAddText (text) {
   if (!errorText) {
      errorText = text;
      domErrors.style.display = "block";
   }
   else
      errorText += "\n" + text;
   errorUpdateText (errorText);
}

function errorUpdateText (text) {
   // How many lines in text?
   if (!text)
      return;
   var lines = text.split ('\n');

   // Get maximum width/height for drawing.
   var maxw = domOuter.offsetWidth  * 0.95;
   var maxh = domOuter.offsetHeight * 0.95;
   var size = 32;

   domErrors.innerHTML = "";
   domErrors.style.fontSize = size + "px";
   domErrors.innerHTML = text;

   if (domErrors.offsetWidth > maxw) {
      var ratio = maxw / domErrors.offsetWidth;
      size *= ratio;
      domErrors.style.fontSize = size + "px";
   }
   if (domErrors.offsetHeight > maxh) {
      var ratio = maxh / domErrors.offsetHeight;
      size *= ratio;
      domErrors.style.fontSize = size + "px";
   }
}

function removeTrailing (string) {
   var newLen = string.length;
   for (var i = newLen - 1; i > 0; i--) {
      if (string[i] == '\n' || string[i] == '\r' ||
          string[i] == ' '  || string[i] == '\0') {
         newLen = i;
      }
      else
         break;
   }
   return string.substr (0, newLen);
}
