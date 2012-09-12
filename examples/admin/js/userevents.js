var clickItem = function(event){
	event.preventDefault();
	var item = $(event.target);
	var pub = item.hasClass("publisher");
	var type = getItemType(item);
	if (currState == NONE_SELECTED){
		firstClick(item, type, pub);
	} else {
		secondClick(item, type, pub);
	}
}

var firstClick = function(item, type, pub){
	item.addClass("selected");
	var context = {
		type:type,
		pub:pub ? "pub" : "sub"
	};
	var cssFile = cssTypeTemplate(context);
	console.log('turning on ' + cssFile);
	$("link#selected").attr('href',cssFile);
	if (pub){
		currState = PUB_SELECTED;
	} else {
		currState = SUB_SELECTED;
	}
};

var secondClick = function(item, type, pub){
	var pubSelected = (currState == PUB_SELECTED);
	//if we clicked in the same column as the first click,
	//then turn off 'selected' mode
	if ((pubSelected && pub) ||
			(!pubSelected && !pub)){
		console.log('turning off');
		$("link#selected").attr('href','');
		$(".item").removeClass('selected');
		currState = NONE_SELECTED;
	} else {
		var activeItem = $(pubSelected ? ".publisher.selected" : ".subscriber.selected");
		var activeType = getItemType(activeItem);
		//only do something if we clicked on a similar-type item
		if (type == activeType){
			var isSelected = item.hasClass('selected');
			//trigger (un)routing
			//temporarily, toggle selected class
			item.toggleClass('selected');
		}
	}
};

var getItemType = function(_item){
	return _item.hasClass("boolean") ? "boolean" : _item.hasClass("string") ? "string" : "range";
};

var cssTypeTemplate = Handlebars.compile("css/{{pub}}_{{type}}.css");