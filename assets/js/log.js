
module.exports = function(id) {
  var elem = document.getElementById(id);

  return function(msg) {
    elem.innerHTML += (msg + "<br/>");
    elem.scrollTop = elem.scrollHeight;
  }
}
