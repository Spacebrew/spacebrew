//static regex and function to replace all non-alphanumeric characters
//in a string with their unicode decimal surrounded by hyphens
//and a regex/function pair to do the reverse
String.SafetifyRegExp = new RegExp("([^a-zA-Z0-9])","gi");
String.UnsafetifyRegExp = new RegExp("-(.*?)-","gi");
String.SafetifyFunc = function(match, capture, index, full){
	return "-"+capture.charCodeAt(0)+"-";
};
String.UnsafetifyFunc = function(match, capture, index, full){
	return String.fromCharCode(capture);
};

//create a String prototype function so we can do this directly on each string as
//"my cool string".Safetify()
String.prototype.Safetify = function(){
	return this.replace(String.SafetifyRegExp, String.SafetifyFunc);
};
String.prototype.Unsafetify = function(){
	return this.replace(String.UnsafetifyRegExp, String.UnsafetifyFunc);
};

//global functions so we can call ['hello','there'].map(Safetify)
Safetify = function(s){
	return s.Safetify();
};
Unsafetify = function(s){
	return s.Unsafetify();
};

//handlebar helper so we can use Safetify in our handlebar templates
//{{Safetify some.cool.property}}
Handlebars.registerHelper('Safetify', function(val){
  return val.Safetify();
});

//handlebar helper to provide an {{index}} property in our each loops
//{{#each_with_index people}}
//  <div>#{{index}} - hello {{name}}</div>
//{{/each_with_index}}
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

//get the value of the requested key in the querystring
//if the key does not exist in the query string, returns the empty string
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
