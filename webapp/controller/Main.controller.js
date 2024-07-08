sap.ui.define([
    "aspno1coffee/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/dnd/DragInfo",
	"sap/f/dnd/GridDropInfo",
    "aspno1coffee/controller/RevealGrid/RevealGrid",
    "sap/ui/core/library",
    "sap/ui/model/Filter",
    'sap/ui/core/Fragment',
    "sap/m/MessageBox",
],
function (Controller, JSONModel, DragInfo, GridDropInfo, RevealGrid, coreLibrary, Filter, Fragment, MessageBox) {
    "use strict";

	var DropLayout = coreLibrary.dnd.DropLayout;
	var DropPosition = coreLibrary.dnd.DropPosition;

    return Controller.extend("aspno1coffee.controller.Main", {
        onInit: function () {
            this.getRouter().getRoute("Main").attachMatched(this._onRouteMatched, this);
			var oCardManifests = new JSONModel(sap.ui.require.toUrl("aspno1coffee/cardManifests.json"));
			this.getView().setModel(oCardManifests, "manifests");
            
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
            this.setModel(new JSONModel({dateVar: '', }), 'searchModel');
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

        getOrderData: function(aFilter = []) {
            var oMainModel = this.getOwnerComponent().getModel('Order');
            this._getODataRead(oMainModel, "/Ordered", aFilter).done(function(aGetData){
                console.log(aGetData);
                if(aFilter.length < 1){
                    var totalAmount = 0;
                    var totalBomAmount = 0;
                    var totalMenu = 0;
    
                    aGetData.map((order) => {
                        totalAmount += parseInt(order.TotalAmount);
                        totalBomAmount += parseInt(order.BomAmount);
                    })
                    totalMenu = aGetData.length;
    
                    var headerInfo = {
                        totalAmount: totalAmount,
                        totalBomAmount : totalAmount - totalBomAmount,
                        totalMenu
                    }
                    this.setModel(new JSONModel(headerInfo), 'headerModel');
                }
                this.setModel(new JSONModel(aGetData), 'orderModel');
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){

            });
        },

        getOrderItemData: function(OrderUuid) {
            return new Promise((resolve, reject) => {
                var oMainModel = this.getOwnerComponent().getModel('Order');
                var aFilter = [new Filter("Uuid", "EQ", OrderUuid)];
        
                this._getODataRead(oMainModel, "/Ordered", aFilter, '$expand=to_OrderItem')
                    .done(function(aGetData) {
                        console.log(aGetData[0].to_OrderItem.results);
                        var oOrderItemModel = new JSONModel(aGetData[0].to_OrderItem.results);
                        this.getView().setModel(oOrderItemModel, 'orderItemModel');
                        resolve();
                    }.bind(this))
                    .fail(function() {
                        MessageBox.information("Read Fail");
                        reject();
                    });
            });
        },
        

        getMaterialData: function() {

        },

        getMenuData: function() {

        },

        refresh: function() {
            this.getInventoryData();
            this.getOrderData();
        },

        /////////////////// DASGBOARD ///////////////////

		onRevealGrid: function () {
			RevealGrid.toggle("grid1", this.getView());
		},

		onExit: function () {
			RevealGrid.destroy("grid1", this.getView());
		},









        /////////////////// ORDERLIST ///////////////////

        onPressOpenPopover: function(oEvent) {
            var oView = this.getView();
            var oSourceControl = oEvent.getSource();
            var selectedOrder = oSourceControl.getBindingContext('orderModel').getObject();
            console.log(selectedOrder);
        
            this.getOrderItemData(selectedOrder.Uuid)
                .then(function() {
                    if (!this._pPopover) {
                        this._pPopover = Fragment.load({
                            id: oView.getId(),
                            name: "aspno1coffee.view.Fragments.orderDetail"
                        }).then(function(oPopover) {
                            oView.addDependent(oPopover);
                            return oPopover;
                        });
                    }
        
                    this._pPopover.then(function(oPopover) {
                        // Popover에 모델 설정
                        console.log(oView.getModel('orderItemModel').getData());
                        oPopover.setModel(oView.getModel('orderItemModel'), 'orderItemModel');
                        oPopover.openBy(oSourceControl);
                    });
                }.bind(this))
                .catch(function() {
                    console.error("Failed to load order item data");
                });
        },

        handleChange: function(oEvent) {
            var sSelectedDate = oEvent.getParameter("value"); // DatePicker에서 선택된 날짜 값 (yyyyMMdd 형식)
        
            // 시작 시간 설정 (yyyy-MM-ddTHH:mm:ss.SSSZ 형식으로 변환)
            var sStartDateTime = sSelectedDate.slice(0, 4) + '-' + sSelectedDate.slice(4, 6) + '-' + sSelectedDate.slice(6) + 'T00:00:00.000Z';
        
            // 종료 시간 설정 (yyyy-MM-ddTHH:mm:ss.SSSZ 형식으로 변환)
            var sEndDateTime = sSelectedDate.slice(0, 4) + '-' + sSelectedDate.slice(4, 6) + '-' + sSelectedDate.slice(6) + 'T23:59:59.999Z';
        
            // 필터 설정
            var aFilters = [
                new sap.ui.model.Filter("OrderDate", sap.ui.model.FilterOperator.GE, sStartDateTime),
                new sap.ui.model.Filter("OrderDate", sap.ui.model.FilterOperator.LE, sEndDateTime)
            ];
        
            // getOrderData 함수 호출
            this.getOrderData(aFilters);
        },
        


        /////////////////// INVENTORY ///////////////////




        //////////////////// PAYMENT ////////////////////
    });
});
