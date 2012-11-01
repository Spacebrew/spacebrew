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
