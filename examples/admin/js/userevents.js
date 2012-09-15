var overItem = function(event){
	event.preventDefault();
	if (currState == NONE_SELECTED){
		var item = $(event.target).children();
		var pub = item.hasClass("publisher");
		var type = getItemType(item);
		var itemId = item.prop('id');
		var pieces = itemId.split('_');
		var context = {
			type:type,
			id:item.prop('id'),
			pub:pub,
			clientid:pieces[1]+'_'+pieces[2]
		};
		console.log(pieces[1]+'_'+pieces[2]);
		$("style#selected").text(cssSelectedTemplate(context));
	}
};

var outItem = function(event){
	event.preventDefault();
	if (currState == NONE_SELECTED){
		$("style#selected").text('');
	}
};

var clickItem = function(event){
	event.preventDefault();
	var item = $(event.target).children();
	var pub = item.hasClass("publisher");
	var type = getItemType(item);
	if (currState == NONE_SELECTED){
		firstClick(item, type, pub);
	} else {
		secondClick(item, type, pub);
	}
};

var firstClick = function(item, type, pub){
	item.addClass("selected");
	item.closest(".clientrow").addClass("selected");
	var context = {
		clicked:true,
		type:type,
		id:item.prop('id'), 
		pub:pub
	};
	var cssFile = cssTypeTemplate(context);
	console.log('turning on ' + cssFile);
	$("style#selected").text(cssSelectedTemplate(context));// attr('href',cssFile);
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
		$("style#selected").text('');
		$(".item.selected").removeClass('selected');
		$(".clientrow.selected").removeClass('selected');
		currState = NONE_SELECTED;
	} else {
		var activeItem = $(pubSelected ? ".publisher.selected" : ".subscriber.selected");
		var activeType = getItemType(activeItem);
		//only do something if we clicked on a similar-type item
		if (type == activeType){
			//trigger (un)routing
			var activeId = activeItem.prop('id');
			var isSelected = item.hasClass(activeId);
			var myId = item.prop('id');
			var pubId = pubSelected ? activeId : myId;
			var subId = pubSelected ? myId : activeId;
			//if this is selected, then we need to unroute it
			if (isSelected){
				removeRoute(pubId, subId);
			} else {
			//otherwise, route it
				addRoute(pubId, subId);
			}
		}
	}
};

var getItemType = function(_item){
	return _item.hasClass("boolean") ? "boolean" : _item.hasClass("string") ? "string" : _item.hasClass("number") ? "number" : "range";
};

var cssTypeTemplate = Handlebars.compile("css/{{pub}}_{{type}}.css");
var cssSelectedTemplate = Handlebars.compile(document.getElementById( 'active_css_handlebar' ).textContent);
