/**
 * PrimeFaces Tree Widget
 */
PrimeFaces.widget.Tree = function(id, cfg) {
    this.id = id;
    this.cfg = cfg;
    this.jqId = PrimeFaces.escapeClientId(this.id);
    this.jq = jQuery(this.jqId);

    if(this.cfg.selectionMode) {
        this.selectionHolder = jQuery(this.jqId + '_selection');
        this.selections = [];
    }

    this.bindEvents(this.jq.find('.ui-tree-node-content'));

    if(!this.cfg.dynamic) {
        this.cookieName = this.id + '_state';
        this.restoreClientState();
    }

    if(this.cfg.dragdrop) {
        this.setupDragDrop();
    }
}

PrimeFaces.widget.Tree.prototype.bindEvents = function(elements) {
    var _self = this,
    selectionMode = this.cfg.selectionMode;

    //expand-collapse
    elements.children('.ui-tree-icon').click(function(e) {
        var icon = jQuery(this),
        node = icon.parents('li:first');

        if(icon.hasClass('ui-icon-triangle-1-e'))
            _self.expandNode(node);
        else
            _self.collapseNode(node);
    });

    //selection hover
    if(selectionMode) {
        var clickTarget = selectionMode == 'checkbox' ? elements.children('.ui-tree-checkbox').children() : elements;

        clickTarget.mouseover(function() {
            jQuery(this).addClass('ui-state-hover');
        })
        .mouseout(function() {
            jQuery(this).removeClass('ui-state-hover');
        })
        .click(function(e) {
            _self.onNodeClick(e, jQuery(this).parents('li:first'));
        });
    }
}

PrimeFaces.widget.Tree.prototype.onNodeClick = function(e, node) {
    if(jQuery(e.target).is(':not(.ui-tree-icon)')) {
        if(this.isNodeSelected(node))
            this.unselectNode(node);
        else
            this.selectNode(node);
    }
}

PrimeFaces.widget.Tree.prototype.expandNode = function(node) {
    var _self = this;

    if(this.cfg.dynamic) {

        if(this.cfg.cache && node.children('.ui-tree-nodes').length > 0) {
            this.showNodeChildren(node, true);
            
            return;
        }

        var options = {
            source: this.id,
            process: this.id,
            update: this.id,
            formId: this.cfg.formId
        };

        if(this.cfg.hasExpandListener && this.cfg.onExpandUpdate) {
            options.update = options.update + ' ' + this.cfg.onExpandUpdate;
        }

        options.onsuccess = function(responseXML) {
            var xmlDoc = responseXML.documentElement,
            updates = xmlDoc.getElementsByTagName("update");

            for(var i=0; i < updates.length; i++) {
                var id = updates[i].attributes.getNamedItem("id").nodeValue,
                content = updates[i].firstChild.data;

                if(id == _self.id){
                    node.append(content);
                    _self.bindEvents(node.children('.ui-tree-nodes').find('.ui-tree-node-content'));
 
                    _self.showNodeChildren(node, true);
                }
                else {
                    PrimeFaces.ajax.AjaxUtils.updateElement(id, content);
                }
            }

            return false;
        };

        var params = {};
        params[this.id + '_expandNode'] = _self.getNodeId(node);

        PrimeFaces.ajax.AjaxRequest(this.cfg.url, options, params);
    }
    else {
        this.showNodeChildren(node, true);
        this.saveClientState();
    }
}

PrimeFaces.widget.Tree.prototype.collapseNode = function(node) {
    var _self = this,
    icon = node.find('.ui-tree-icon:first'),
    lastClass = node.attr('class').split(' ').slice(-1),
    nodeIcon = icon.next(),
    iconState = this.cfg.iconStates[lastClass];

    icon.addClass('ui-icon-triangle-1-e').removeClass('ui-icon-triangle-1-s');

    if(iconState) {
        nodeIcon.removeClass(iconState.expandedIcon).addClass(iconState.collapsedIcon);
    }

    node.children('.ui-tree-nodes').hide('fade', {}, 'fast', function() {
        if(_self.cfg.dynamic) {
            if(!_self.cfg.cache) {
                jQuery(this).remove();

                if(_self.cfg.hasCollapseListener) {
                    _self.fireNodeCollapseEvent(node);
                }
            }
        }
        else {
            _self.saveClientState();
        }
    });
}

PrimeFaces.widget.Tree.prototype.showNodeChildren = function(node, animate) {
    var icon = node.find('.ui-tree-icon:first'),
    lastClass = node.attr('class').split(' ').slice(-1),
    nodeIcon = icon.next(),
    iconState = this.cfg.iconStates[lastClass];

    icon.addClass('ui-icon-triangle-1-s').removeClass('ui-icon-triangle-1-e');

    if(iconState) {
        nodeIcon.removeClass(iconState.collapsedIcon).addClass(iconState.expandedIcon);
    }

    if(animate)
        node.children('.ui-tree-nodes').show('fade', {}, 'fast');
    else
        node.children('.ui-tree-nodes').show();
}

PrimeFaces.widget.Tree.prototype.saveClientState = function() {
    var _self = this,
    expandedNodes = [];
    
    jQuery(this.jq).find('li').each(function() {
        var node = jQuery(this),
        icon = node.find('.ui-tree-icon:first');

        if(icon.hasClass('ui-icon-triangle-1-s')) {
            expandedNodes.push(node.attr('id'));
        }
    });

    PrimeFaces.setCookie(this.cookieName, expandedNodes.join(','));
}

PrimeFaces.widget.Tree.prototype.restoreClientState = function() {
    var expandedNodes = PrimeFaces.getCookie(this.cookieName);
    
    if(expandedNodes) {
        expandedNodes = expandedNodes.split(',');

        for(var i in expandedNodes) {
            var node = jQuery(PrimeFaces.escapeClientId(expandedNodes[i]));

            this.showNodeChildren(node, false);
        }
    }
}

PrimeFaces.widget.Tree.prototype.selectNode = function(node) {

    if(this.isSingleSelection()) {
        //clean all selections
        this.selections = [];
        this.jq.find('.ui-tree-node-content.ui-state-highlight').removeClass('ui-state-highlight');
    }

    //select node
    if(this.isCheckboxSelection()) {
        this.toggleCheckbox(node, true);
    }
    else {
        node.find('.ui-tree-node-content:first').addClass('ui-state-highlight');
    }
    
    this.selections.push(this.getNodeId(node));

    this.writeSelections();

    if(this.cfg.instantSelect) {
        this.fireNodeSelectEvent(node);
    }
}

PrimeFaces.widget.Tree.prototype.unselectNode = function(node) {
    var nodeId = this.getNodeId(node);

    //select node
    if(this.isCheckboxSelection()) {
        this.toggleCheckbox(node, false);
    }
    else {
        node.find('.ui-tree-node-content:first').removeClass('ui-state-highlight');
    }

    //remove from selection
    this.selections = jQuery.grep(this.selections, function(r) {
        return r != nodeId;
    });

    this.writeSelections();
}

PrimeFaces.widget.Tree.prototype.writeSelections = function() {    
    this.selectionHolder.val(this.selections.join(','));
}

PrimeFaces.widget.Tree.prototype.fireNodeSelectEvent = function(node) {
    var options = {
        source: this.id,
        process: this.id,
        formId: this.cfg.formId
    };

    if(this.cfg.onSelectUpdate) {
        options.update = this.cfg.onSelectUpdate;
    }

    options.onstart = this.cfg.onSelectStart;
    options.onstart = this.cfg.onSelectComplete;

    var params = {};
    params[this.id + '_instantSelection'] = this.getNodeId(node);

    PrimeFaces.ajax.AjaxRequest(this.cfg.url, options, params);
}

PrimeFaces.widget.Tree.prototype.fireNodeCollapseEvent = function(node) {
    var options = {
        source: this.id,
        process: this.id,
        update: this.cfg.onCollapseUpdate,
        formId: this.cfg.formId
    };

    var params = {};
    params[this.id + '_collapseNode'] = this.getNodeId(node);

    PrimeFaces.ajax.AjaxRequest(this.cfg.url, options, params);
}

PrimeFaces.widget.Tree.prototype.getNodeId = function(node) {
    return node.attr('id').split('_node_')[1];
}

PrimeFaces.widget.Tree.prototype.isNodeSelected = function(node) {
    return jQuery.inArray(this.getNodeId(node), this.selections) != -1;
}

PrimeFaces.widget.Tree.prototype.isSingleSelection = function() {
    return this.cfg.selectionMode == 'single';
}

PrimeFaces.widget.Tree.prototype.isCheckboxSelection = function() {
    return this.cfg.selectionMode == 'checkbox';
}

PrimeFaces.widget.Tree.prototype.toggleCheckbox = function(node, check) {
    var icon = node.find('.ui-tree-checkbox-icon:first');

    if(check)
        icon.addClass('ui-icon ui-icon-check')
    else
        icon.removeClass('ui-icon ui-icon-check');
}

PrimeFaces.widget.Tree.prototype.setupDragDrop = function() {
    var _self = this;

    //make all labels draggable
    this.jq.find('.ui-tree-node-label').draggable({
        revert:'invalid',
        helper: 'clone',
        containment: this.jqId
    });

    //make all node contents droppable
    this.jq.find('.ui-tree-node-content').droppable({
        hoverClass: 'ui-state-hover',
        drop: function(event, ui) {
            var newParent = jQuery(this).parents('li:first'),
            draggedNode = ui.draggable.parents('li:first'),
            newParentChildrenContainer = newParent.children('.ui-tree-nodes'),
            oldParent = null;

            //ignore self dragdrop
            if(newParent.attr('id') == draggedNode.attr('id')) {
                return;
            }

            //If newParent had no children before, make it a parent
            if(newParentChildrenContainer.length == 0) {
                newParent.append('<ul class="ui-tree-nodes ui-helper-reset ui-tree-child"></ul>')
                .removeClass('ui-tree-item').addClass('ui-tree-parent')
                .find('.ui-tree-node-content:first').prepend('<span class="ui-tree-icon ui-icon ui-icon-triangle-1-s"></span>');
            }

            //If old parent has no children left, make it a leaf
            if(draggedNode.siblings().length == 0) {
                oldParent = draggedNode.parents('li:first');
                newParent.children('.ui-tree-nodes').append(draggedNode);
                oldParent.removeClass('ui-tree-parent').addClass('ui-tree-item');
                oldParent.find('.ui-tree-icon:first').remove();
                oldParent.children('.ui-tree-nodes').remove();
            }
            else {
                //append droppedNode to newParent
                newParent.children('.ui-tree-nodes').append(draggedNode);
            }

            draggedNode.hide().fadeIn('fast');
        }
    });
}