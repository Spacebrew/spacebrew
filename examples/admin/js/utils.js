String.SafetifyRegExp = new RegExp("([^a-zA-Z0-9])","gi");
String.UnsafetifyRegExp = new RegExp("-(.*?)-","gi");
String.SafetifyFunc = function(match, capture, index, full){
	return "-"+capture.charCodeAt(0)+"-";
};
String.UnsafetifyFunc = function(match, capture, index, full){
	return String.fromCharCode(capture);
};

String.prototype.Safetify = function(){
	return this.replace(String.SafetifyRegExp, String.SafetifyFunc);
};

String.prototype.Unsafetify = function(){
	return this.replace(String.UnsafetifyRegExp, String.UnsafetifyFunc);
};

Safetify = function(s){
	return s.Safetify();
};
Unsafetify = function(s){
	return s.Unsafetify();
};

Handlebars.registerHelper('Safetify', function(val){
  return val.Safetify();
});

Handlebars.registerHelper("each_with_index", function(array, fn) {
  var buffer = "";
  for (var i = 0, j = array.length; i < j; i++) {
    var item = array[i];

    // stick an index property onto the item, starting with 0, may make configurable later
    item.index = i;
    //also adding an even/odd text for classing
    item.even = ((i%2)===0?"even":"odd");

    // show the inside of the block
    buffer += fn(item);
  }

  // return the finished buffer
  return buffer;

});

function gup( name ) {
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if( results == null )
    return "";
  else
    return results[1];
};

/** 
 * Load handlebars templates from external files
 */
getTemplateAjax = function(path, callback) {
    $.ajax({
        url: path,
        dataType: "html",
        cache: false,
        success: callback
    });         
};
