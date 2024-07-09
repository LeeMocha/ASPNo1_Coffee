sap.ui.define([
    "aspno1coffee/controller/BaseController", 
    'sap/ui/model/json/JSONModel', 
    'sap/m/Menu', 
    'sap/m/MenuItem'
],
function(Controller, JSONModel, Menu, MenuItem) {
	"use strict";

    return Controller.extend("aspno1coffee.controller.Order", {
		onInit : function () {
            this.getRouter().getRoute("Order").attachMatched(this._onRouteMatched, this);
		},

        _onRouteMatched: function() {
            this.setOriginModel();
            this.setSubModel();
        },

		onToggleContextMenu: function(oEvent) {
			if (oEvent.getParameter("pressed")) {
				this.byId("Tree").setContextMenu(new Menu({
					items: [
						new MenuItem({text: "{text}"})
					]
				}));
			} else {
				this.byId("Tree").destroyContextMenu();
			}
		},

        setOriginModel: function() {
            var oMainModel = this.getOwnerComponent().getModel('Menu');
            this._getODataRead(oMainModel, "/Menu").done(function(aGetData){

                var treeModel =[
                    {
                        "MenuName": "커피",
                        "state": true,
                        "nodes": []
                    },
                    {
                        "MenuName": "논커피",
                        "state": true,
                        "nodes": []
                    }
                ]

                treeModel.map(node => {
                    if(node.text = '커피'){
                        aGetData.map( menu => {
                            menu?node.nodes.push({MenuName:menu.MenuName, MenuPrice:menu.MenuPrice}):""
                        })
                    } else {
                        aGetData.map( menu => {
                            menu?node.nodes.push({MenuName:menu.MenuName, MenuPrice:menu.MenuPrice}):""
                        })
                    }
                })

                console.log(treeModel)
                
                this.setModel(new JSONModel(treeModel), 'menuModel');
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){

            });
        },

        setSubModel: function() {

        },

        getMenuData: function(){

        }

    });
})