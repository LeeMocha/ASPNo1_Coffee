sap.ui.define([
    "aspno1coffee/controller/BaseController", 
    'sap/ui/model/json/JSONModel', 
    'sap/m/Menu', 
    'sap/m/MenuItem',
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/List",
    "sap/m/StandardListItem"
],
function(Controller, JSONModel, Menu, MenuItem, MessageBox, Filter, Dialog, Button, List, StandardListItem) {
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
            this.getCategoryData();
        },

        setSubModel: function() {
            this.setModel(new JSONModel([]),'cartModel');
            this.setModel(new JSONModel({totalAmount: 0}), 'totalAmountModel');
            this.setModel(new JSONModel({state: false}), 'orderDetailModel');
        },

        getCategoryData: function() {
            var oMainModel = this.getOwnerComponent().getModel('Category');
            this._getODataRead(oMainModel, "/Category").done(function(aGetData){
                console.log(aGetData);
                this.categorys = aGetData;
                this.getMenuData();
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){
            });
        },

        getMenuData: function(){
            var oMainModel = this.getOwnerComponent().getModel('Menu');
            var categorys = this.categorys;
            this._getODataRead(oMainModel, "/Menu").done(function(aGetData){
            var treeModel = []
                categorys.map((category, index) => {
                    treeModel.push({
                        "MenuName": category.Category,
                        "state": true,
                        "nodes": []
                    });

                    aGetData.map( menu => {
                        menu.CategoryUuid === category.Uuid ? treeModel[index].nodes.push({
                            MenuUuid: menu.Uuid, 
                            MenuName:menu.MenuName, 
                            MenuPrice:menu.MenuPrice,
                            state: menu.MenuState==='X'?true:false,
                            MenuState:menu.MenuState
                        }):""
                    })

                })

                console.log(treeModel)
                
                this.setModel(new JSONModel(treeModel), 'menuModel');
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){

            });
        },

        moveToCart: function(oEvent) {
            var selectData = oEvent.getSource().getBindingContext("menuModel").getObject();
            var cartData = this.getModel('cartModel').getData()

            // 카트에서 이미 존재하는 품목인지 확인
            var itemExists = false;
            for (var i = 0; i < cartData.length; i++) {
                if (cartData[i].MenuName === selectData.MenuName) {
                    // 이미 존재하는 품목이면 MenuCnt 증가
                    cartData[i].MenuCnt += 1;
                    itemExists = true;
                    break;
                }
            }
            
            // 존재하지 않는 품목이면 새로 추가
            if (!itemExists) {
                cartData.push({ ...selectData, MenuCnt: 1 });
            }

            this.setModel(new JSONModel(cartData),'cartModel')

            this._updateTotalAmount()
        },

        deleteCart: function(oEvent) {
            // 버튼이 눌린 아이템의 바인딩 컨텍스트에서 데이터를 가져옴
            var selectedData = oEvent.getSource().getBindingContext("cartModel").getObject();
            
            // 모델과 그 데이터를 가져옴
            var cartData = this.getView().getModel("cartModel").getData();

            // 데이터 배열에서 해당 아이템을 찾아 제거함
            for (var i = 0; i < cartData.length; i++) {
                if (cartData[i].MenuName === selectedData.MenuName) {
                    cartData.splice(i, 1);
                    break;
                }
            }
            
            this.setModel(new JSONModel(cartData), 'cartModel');
            
            // 총 금액도 다시 계산하여 갱신해야 함
            this._updateTotalAmount();
        },
        
        _updateTotalAmount: function() {
            // 카트 모델과 데이터를 가져옴
            var cartData = this.getView().getModel("cartModel").getData();
            
            // 총 금액을 계산
            var iTotalAmount = 0;
            cartData.map(item => {
                iTotalAmount += item.MenuPrice * item.MenuCnt;
            });
            
            // 총 금액 모델에 갱신
            var oTotalAmountModel = this.getView().getModel("totalAmountModel");
            oTotalAmountModel.setProperty("/totalAmount", iTotalAmount);
        },

        resetCart: function() {
            this.setModel(new JSONModel([]),'cartModel');
            this._updateTotalAmount();
        },

        deepCreateOrder: function() {
            var that = this
            var oMainModel = this.getOwnerComponent().getModel('Order');
            var cartData = this.getModel('cartModel').getData();
            var orderData = {OrderDate : new Date(), to_OrderItem: cartData}

            if(cartData.length > 0 ){
                MessageBox.confirm("주문 하시겠습니까?", {
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    onClose: oAction => {
                        if (oAction === MessageBox.Action.YES) {
                            this._getODataCreate(oMainModel, "/Ordered", orderData).done(function(aGetData){
                                var totalAmount = 0;
                                var totalMenu = 0;
                                aGetData.to_OrderItem.results.map( orederItem => {
                                    totalAmount += orederItem.MenuPrice * orederItem.MenuCnt;
                                    totalMenu += parseInt(orederItem.MenuCnt);
                                })

                                that.setModel(new JSONModel([]), 'cartModel');
                                that.setModel(new JSONModel({...aGetData, totalMenu: totalMenu, totalAmount: totalAmount, state: true}),'orderDetailModel')
                                that._updateTotalAmount();
                                MessageBox.alert('정상적으로 주문되었습니다.');
                            }.bind(this)).fail(function(){
                                MessageBox.information("Read Fail");
                            }).always(function(){

                            });
                        }
                    }
                })
            } else {
                MessageBox.alert('먼저 메뉴를 선택해 주시기 바랍니다.'); 
            }



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

        onDraggableDialogPress: function (oEvent) {
            var selectedOrder = this.getModel('orderDetailModel').getData();
            this.getOrderItemData(selectedOrder.Uuid)
                .then(function() {
                    this.oDraggableDialog = new Dialog({
                        title: '주문번호 : ' + selectedOrder.OrderCode,
                        contentWidth: "300px",
                        contentHeight: "400px",
                        draggable: true,
                        content: new List({
                            items: {
                                path: "orderItemModel>/",
                                template: new StandardListItem({
                                    title: "{orderItemModel>MenuName}",
                                    description : "{= ${orderItemModel>MenuCnt} + 'EA' }",
                                    counter: "{= ${orderItemModel>MenuPrice}*1 }"
                                })
                            }
                        }),
                        endButton: new Button({
                            text: "닫기",
                            press: function () {
                                this.oDraggableDialog.close();
                            }.bind(this)
                        })
                    });
                //to get access to the controller's model
                this.getView().addDependent(this.oDraggableDialog);
                this.oDraggableDialog.open();
            }.bind(this))
            .catch(function() {
                console.error("Failed to load order item data");
            });
		},

    });
})