sap.ui.define([
    "aspno1coffee/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/dnd/DragInfo",
	"sap/f/dnd/GridDropInfo",
    "aspno1coffee/controller/RevealGrid/RevealGrid",
    "sap/ui/core/library"
],
function (Controller, JSONModel, DragInfo, GridDropInfo, RevealGrid, coreLibrary) {
    "use strict";

	var DropLayout = coreLibrary.dnd.DropLayout;
	var DropPosition = coreLibrary.dnd.DropPosition;

    return Controller.extend("aspno1coffee.controller.Main", {
        onInit: function () {
            this.getRouter().getRoute("Main").attachMatched(this._onRouteMatched, this);
            var oGrid = this.byId("grid1");
            oGrid.addDragDropConfig(new DragInfo({
				sourceAggregation: "items"
			}));
            oGrid.addDragDropConfig(new GridDropInfo({
				targetAggregation: "items",
				dropPosition: DropPosition.Between,
				dropLayout: DropLayout.Horizontal,
				drop: function (oInfo) {
					var oDragged = oInfo.getParameter("draggedControl"),
						oDropped = oInfo.getParameter("droppedControl"),
						sInsertPosition = oInfo.getParameter("dropPosition"),
						iDragPosition = oGrid.indexOfItem(oDragged),
						iDropPosition = oGrid.indexOfItem(oDropped);

					oGrid.removeItem(oDragged);

					if (iDragPosition < iDropPosition) {
						iDropPosition--;
					}

					if (sInsertPosition === "After") {
						iDropPosition++;
					}

					oGrid.insertItem(oDragged, iDropPosition);
					oGrid.focusItem(iDropPosition);
				}
			}));

			// Use smaller margin around grid when on smaller screens
			oGrid.attachLayoutChange(function (oEvent) {
				var sLayout = oEvent.getParameter("layout");

				if (sLayout === "layoutXS" || sLayout === "layoutS") {
					oGrid.removeStyleClass("sapUiSmallMargin");
					oGrid.addStyleClass("sapUiTinyMargin");
				} else {
					oGrid.removeStyleClass("sapUiTinyMargin");
					oGrid.addStyleClass("sapUiSmallMargin");
				}
			});
        },

        _onRouteMatched: function() {
            this.setOriginModel();
            this.setSubModel();
        },

        setOriginModel: function() {
            this.getInventoryData();
            this.getOrderData();
        },

        setSubModel: function() {

        },

        getInventoryData: function() {
            var oMainModel = this.getOwnerComponent().getModel();
            this._getODataRead(oMainModel, "/Inventory").done(function(aGetData){
                console.log(aGetData);
                this.setModel(new JSONModel(aGetData), 'inventoryModel');
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){

            });
        },

        getOrderData: function() {
            var oMainModel = this.getOwnerComponent().getModel('Order');
            this._getODataRead(oMainModel, "/Ordered").done(function(aGetData){
                console.log(aGetData);
                this.setModel(new JSONModel(aGetData), 'orderModel');
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){

            });
        },

        getMaterialData: function() {

        },

        getMenuData: function() {

        },



        /////////////////// DASGBOARD ///////////////////
		onRevealGrid: function () {
			RevealGrid.toggle("grid1", this.getView());
		},

		onExit: function () {
			RevealGrid.destroy("grid1", this.getView());
		}









        /////////////////// ORDERLIST ///////////////////

        /////////////////// INVENTORY ///////////////////




        //////////////////// PAYMENT ////////////////////
    });
});
