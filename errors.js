window.onerror = function (message, src, line, col, error) {
   alert (src + ": " + (col + 1) + ", " + (line + 1) + "\n\n" + message);
}
