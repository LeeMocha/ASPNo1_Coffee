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
            this.getPaymentData();
        },

        setSubModel: function() {
            this.setModel(new JSONModel({dateVar: '', startTimeVar: '', endTimeVar: '',}), 'searchModel');
            this.setModel(new JSONModel({dateVar: '', startTimeVar: '', endTimeVar: '',}), 'searchModel2');
            this.setModel(new JSONModel({PaymentDescription : '', PaymentAmount : 0}), 'paymentInputModel');
            this._selectedTabKey = "데시보드";
        },

        onTabSelect: function(oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            this._selectedTabKey = oSelectedItem.getText();
        },

        getInventoryData: function() {
            var oMainModel = this.getOwnerComponent().getModel();
            this._getODataRead(oMainModel, "/Inventory").done(function(aGetData){
                this.setModel(new JSONModel(aGetData), 'inventoryModel');
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){

            });
        },

        getOrderData: function(aFilter = []) {
            var oMainModel = this.getOwnerComponent().getModel('Order');
            this._getODataRead(oMainModel, "/Ordered", aFilter).done(function(aGetData){
                if(aFilter.length < 1){
                    var totalAmount = 0;
                    var totalBomAmount = 0;
                    var totalMenu = 0;
    
                    // 오늘 날짜 구하기
                    var today = new Date();
                    var dd = String(today.getDate()).padStart(2, '0');
                    var mm = String(today.getMonth() + 1).padStart(2, '0'); // 0부터 시작하므로 +1
                    var yyyy = today.getFullYear();
                    var formattedToday = yyyy + mm + dd;

                    aGetData.map((order) => {
                        // OrderCode에서 yyyyMMdd 부분만 추출하여 비교
                        var orderDate = order.OrderCode.slice(0, 8);
                        if (orderDate === formattedToday) {
                            totalAmount += parseInt(order.TotalAmount);
                            totalBomAmount += parseInt(order.BomAmount);
                            totalMenu++;
                        }
                    });
    
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
            var oMainModel = this.getOwnerComponent().getModel('Material');
            this._getODataRead(oMainModel, "/Material").done(function(aGetData){
                this.setModel(new JSONModel(aGetData), 'materialModel');
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){

            });
        },

        getMenuData: function() {

        },

        getPaymentData: function(aFilter = []) {
            var oMainModel = this.getOwnerComponent().getModel('Payment');
            this._getODataRead(oMainModel, "/Payment", aFilter).done(function(aGetData){
                this.setModel(new JSONModel(aGetData), 'paymentModel');
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){

            });
        },

        refresh: function() {
            switch (this._selectedTabKey) {
                case '주문현황' : 
                    this.getOrderData();
                    this.getView().byId('datePicker').setValue('');
                    break;
                case '재고현황' :
                    this.getInventoryData();
                    break;
                case '지출현황' :
                    this.getPaymentData();
                    this.getView().byId('datePicker2').setValue('');
                    break;
            }
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


            switch (this._selectedTabKey) {
                case '주문현황' : 
                    // 필터 설정
                    var aFilters = [new Filter({
                        filters: [new Filter("OrderDate", 'GE', sStartDateTime), new Filter("OrderDate", 'LE', sEndDateTime)],
                        and: true
                    })];
                    // getOrderData 함수 호출
                    this.getOrderData(aFilters);
                    break;
                case '지출현황' :
                    var aFilters = [new Filter({
                        filters: [new Filter("PaymentDate", 'GE', sStartDateTime), new Filter("PaymentDate", 'LE', sEndDateTime)],
                        and: true
                    })];
                    this.getPaymentData(aFilters);
                    break;
            }

 
        },
        


        /////////////////// INVENTORY ///////////////////




        //////////////////// PAYMENT ////////////////////

        insertPayment: function() {
            var that = this
            var paymentInput = this.getModel('paymentInputModel').getData();
            var oMainModel = this.getOwnerComponent().getModel('Payment');
            this._getODataCreate(oMainModel, "/Payment", paymentInput).done(function(aGetData){
                
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){
                that.getPaymentData();
                that.setProperty('paymentInputModel', 'PaymentDescription', '');
                that.setProperty('paymentInputModel', 'PaymentAmount', '');
            });
        },

    });
});
