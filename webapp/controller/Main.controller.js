sap.ui.define([
    "aspno1coffee/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/dnd/DragInfo",
	"sap/f/dnd/GridDropInfo",
    "aspno1coffee/controller/RevealGrid/RevealGrid",
    "sap/ui/core/library",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    'sap/ui/core/Fragment',
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/MessageToast",
],
function (Controller, JSONModel, DragInfo, GridDropInfo, RevealGrid, coreLibrary, Filter, FilterOperator, Fragment, 
    MessageBox, Dialog, Button, List, StandardListItem, MessageToast) {
    "use strict";

	var DropLayout = coreLibrary.dnd.DropLayout;
	var DropPosition = coreLibrary.dnd.DropPosition;

    return Controller.extend("aspno1coffee.controller.Main", {
        onInit: function () {
            this.getRouter().getRoute("Main").attachMatched(this._onRouteMatched, this);
			var oCardManifests = new JSONModel(sap.ui.require.toUrl("aspno1coffee/cardManifests.json"));
			this.getView().setModel(oCardManifests, "manifests");
            console.log(this.getModel('manifests'));
            
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
            this.getCategoryData();
            this.getMenuSalesData();
            this.getOrderDataForChart();
        },

        setSubModel: function() {
            this.setModel(new JSONModel({dateVar: '', startTimeVar: '', endTimeVar: '',}), 'searchModel');
            this.setModel(new JSONModel({dateVar: '', startTimeVar: '', endTimeVar: '',}), 'searchModel2');
            this.setModel(new JSONModel({PaymentDescription : undefined, PaymentAmount : undefined}), 'paymentInputModel');
            this.setModel(new JSONModel([]), 'temporaryModel');
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
                this.getMaterialData();
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
            var oInventoryModel = this.getModel('inventoryModel');

            this._getODataRead(oMainModel, "/Material").done(function(aGetData){
                this.setModel(new JSONModel(aGetData), 'materialModel');

                // Inventory 모델의 데이터를 가져오기
                var aInventoryData = oInventoryModel.getData();

                // Inventory 모델의 MaterialUuid를 제외한 재료만 필터링
                var aFilteredData = aGetData.filter(function(material) {
                    return !aInventoryData.some(function(inventoryItem) {
                        return inventoryItem.MaterialUuid === material.Uuid;
                    });
                });

                this.setModel(new JSONModel(aFilteredData), 'productModel');

            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){

            });
        },

        getMenuSalesData: function() {
            var oMainModel = this.getOwnerComponent().getModel('MenuSales');
            this._getODataRead(oMainModel, "/MenuSales").done(function(aGetData){
                var aData = aGetData.map(function(item) {
                    return {
                        MenuName: item.MenuName,
                        Sales: item.Sales
                    };
                });
        
                var oMenuSalesModel = new JSONModel({
                    data: aData
                });
        
                this.getView().setModel(oMenuSalesModel, "menuSalesModel");
        
                var oVizFrame = this.getView().byId("stackedFrame");
                oVizFrame.setModel(oMenuSalesModel, "menuSalesModel");
                oVizFrame.setVizType("stacked_column");
        
                var vizProperties = {
                    title: {
                        text: "메뉴별 판매량",
                        visible: true
                    },
                    legend: {
                        title: {
                            visible: false
                        }
                    },
                    plotArea: {
                        dataLabel: {
                            visible: true
                        }
                    },
                    categoryAxis: {
                        title: {
                            visible: true,
                            text: "메뉴명"
                        }
                    },
                    valueAxis: {
                        title: {
                            visible: true,
                            text: "판매량"
                        }
                    }
                };
        
                oVizFrame.setVizProperties(vizProperties);
                var oPopover = new sap.viz.ui5.controls.Popover({});
                oPopover.connect(oVizFrame.getVizUid());
        
            }.bind(this)).fail(function(){
                MessageBox.information("Read Fail");
            }).always(function(){
            });
        },

        getCategoryData: function() {
            var oMainModel = this.getOwnerComponent().getModel('Category');
            
            return new Promise(function(resolve, reject) {
                this._getODataRead(oMainModel, "/Category")
                    .done(function(aGetData) {
        
                        // 데이터를 변환하여 categoryModel로 설정
                        var aData = aGetData.map(function(item) {
                            return {
                                Category: item.Category,
                                categoryCnt: item.categoryCnt
                            };
                        });
        
                        var oCategoryModel = new JSONModel({
                            data: aData
                        });
        
                        this.getView().setModel(oCategoryModel, "categoryModel");
                        var oVizFrame = this.getView().byId("donutFrame");
                        oVizFrame.setModel(oCategoryModel, "categoryModel");
                        oVizFrame.setVizType("donut");
                        var vizProperties = {
                            interaction: {
                                zoom: {
                                    enablement: "disabled"
                                },
                                selectability: {
                                    mode: "EXCLUSIVE"
                                }
                            },
                            categoryAxis: {
                                title: {
                                    visible: false
                                },
                                label: {
                                    linesOfWrap: 2,
                                    rotation: "fixed",
                                    angle: 0,
                                    style: {
                                        fontSize: "12px"
                                    }
                                },
                                axisTick: {
                                    shortTickVisible: false
                                }
                            },
                            title: {
                                text: "품목별 판매량",
                                visible: true
                            },
                            legend: {
                                visible: true,
                                title: {
                                    visible: true
                                },
                                marker: {
                                    shape: "squar", // 범례 마커 모양 설정
                                    size: 10 // 범례 마커 크기 설정
                                }
                            },
                            plotArea: {
                                gridline: {
                                    visible: false
                                },
                                dataLabel: {
                                    visible: true,
                                    style: {
                                        fontWeight: 'bold'
                                    },
                                    hideWhenOverlap: false
                                }
                            }
                        };
        
                        oVizFrame.setVizProperties(vizProperties);
                        
                        var oPopover = new sap.viz.ui5.controls.Popover({});
                        oPopover.connect(oVizFrame.getVizUid());
        
                        resolve(); // 성공적으로 데이터를 모델에 설정하면 resolve 호출
        
                    }.bind(this))
                    .fail(function() {
                        MessageBox.error("Read Fail");
                        reject(); // 실패 시 reject 호출
                    })
                    .always(function() {
                        // 항상 실행할 로직이 있으면 여기에 추가
                    });
            }.bind(this));
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

        refresh: function(check) {
            switch (this._selectedTabKey) {
                case '데시보드' :
                    this.getCategoryData();
                    this.getMenuSalesData();
                    this.getOrderDataForChart();
                    break;
                case '주문현황' : 
                    this.getOrderData();
                    this.getView().byId('datePicker').setValue('');
                    break;
                case '재고현황' :
                    this.getInventoryData();
                    check ? this.getPaymentData() : '';
                    check ? this.getView().byId('datePicker2').setValue('') : '';
                    break;
                case '지출현황' :
                    this.getPaymentData();
                    this.getView().byId('datePicker2').setValue('');
                    break;
            }
        },

        goToOrder: function() {
            this.navTo('Order', {});
        },

        /////////////////// DASGBOARD ///////////////////

		onRevealGrid: function () {
			RevealGrid.toggle("grid1", this.getView());
		},

		onExit: function () {
			RevealGrid.destroy("grid1", this.getView());
		},

        getOrderDataForChart: function() {
            var oMainModel = this.getOwnerComponent().getModel('Order');
            var aDataPromises = [];
            var dateMap = {};
        
            // 오늘 날짜 구하기
            var today = new Date();
            today.setHours(0, 0, 0, 0);
        
            // 7일 전부터 어제까지의 날짜 배열 만들기
            var dateArray = [];
            for (var i = 7; i >= 0; i--) { // 0일 전도 포함되게 변경
                var date = new Date(today);
                date.setDate(today.getDate() - i);
                dateArray.push(this._formatDate(date));
                dateMap[this._formatDate(date)] = { orderDate: this._formatDate(date), totalAmount: 0, totalBomAmount: 0 };
            }
        
            // 각 날짜별로 데이터를 읽어오는 비동기 처리 설정
            dateArray.forEach(function(formattedDate) {
                var filter = [
                    new Filter('OrderCode', FilterOperator.StartsWith, formattedDate)
                ];
                var promise = this._getODataRead(oMainModel, '/Ordered', filter).then(function(aGetData) {
                    var totalAmount = 0;
                    var totalBomAmount = 0;
        
                    aGetData.forEach(function(order) {
                        totalAmount += parseInt(order.TotalAmount);
                        totalBomAmount += parseInt(order.BomAmount);
                    });
        
                    return {
                        orderDate: formattedDate,
                        totalAmount: totalAmount,
                        totalBomAmount: totalBomAmount
                    };
                });
        
                aDataPromises.push(promise);
            }.bind(this));
        
            // 모든 데이터를 한꺼번에 처리
            Promise.all(aDataPromises).then(function(aResults) {
                // 결과를 날짜별로 매핑
                var resultMap = {};
                aResults.forEach(function(result) {
                    resultMap[result.orderDate] = result;
                });
        
                // 누락된 날짜에 대해 빈 데이터 추가
                dateArray.forEach(function(formattedDate) {
                    if (!resultMap[formattedDate]) {
                        resultMap[formattedDate] = dateMap[formattedDate];
                    }
                });
        
                // 순서대로 정렬된 결과 배열 만들기
                var chartData = dateArray.map(function(formattedDate) {
                    return resultMap[formattedDate];
                });
        
                this.setModel(new JSONModel({data : chartData}), 'weekendModel');
        
                // 차트 속성 설정
                var oVizFrame = this.getView().byId("lineFrame");
                var vizProperties = {
                    title: {
                        text: "일별 주문 금액 및 BOM 금액",
                        visible: true
                    },
                    plotArea: {
                        dataLabel: {
                            visible: true,
                            formatString: "#,##0"
                        }
                    },
                    categoryAxis: {
                        title: {
                            visible: true,
                            text: "날짜"
                        }
                    },
                    valueAxis: {
                        title: {
                            visible: true,
                            text: "금액"
                        }
                    }
                };

                // oVizFrame.setModel(new JSONModel({data : chartData}), "weekendModel");
                oVizFrame.setVizProperties(vizProperties);
        
            }.bind(this)).catch(function(error) {
                MessageBox.error("Error fetching order data: " + error.message);
            });
        },
        
        _formatDate: function(date) {
            var dd = String(date.getDate()).padStart(2, '0');
            var mm = String(date.getMonth() + 1).padStart(2, '0');
            var yyyy = date.getFullYear();
            return yyyy + mm + dd;
        },

        /////////////////// ORDERLIST ///////////////////

        onDraggableDialogPress: function (oEvent) {
            var oSourceControl = oEvent.getSource();
            var selectedOrder = oSourceControl.getBindingContext('orderModel').getObject();
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

        openDialog: function(oEvent) {
            var oSourceControl = oEvent.getSource();
            var selectedInven = oSourceControl.getBindingContext('inventoryModel').getObject();
            var buttonId = oSourceControl.getId();
            this.flag = true;

            if(buttonId.includes("discard")){
                this.flag = false;
            } 
            console.log(this.flag);
            this.setModel(new JSONModel({
                Uuid: selectedInven.Uuid,
                MaterialUuid : selectedInven.MaterialUuid,
                MaterialName : selectedInven.MaterialName,
                InventoryQuantity : selectedInven.InventoryQuantity, 
                MaterialQuantity : selectedInven.MaterialQuantity,
                quantity: this.flag?selectedInven.MaterialQuantity:0,
                Qunit: selectedInven.Qunit,
                MaterialCnt : 1,
                state: this.flag}), 'deleteInvenModel')
            // create dialog lazily
            if (!this.oSIDialog) {
                this.oSIDialog = this.loadFragment({
                    name: "aspno1coffee.view.Fragments.InvenDialog"
                });
            }
            this.oSIDialog.then(function (oDialog) {
                this.oDialog = oDialog;
                this.getView().addDependent(this.oDialog);
                this.oDialog.open();
            }.bind(this));
        },

        _closeDialog: function () {
			this.oDialog.close();
		},

        invenMethod: function() {
            var that = this;
            var oMainModel = this.getOwnerComponent().getModel();
            var updateInven = this.getModel('deleteInvenModel').getData();
            var currentQuantity = parseInt(updateInven.InventoryQuantity, 10);
            var quantityChange = parseInt(updateInven.quantity, 10);
        
            var newQuantity = 0
            if(this.flag) {
                var materialModelData = this.getModel('materialModel').getData();
                // MaterialUuid에 해당하는 데이터를 찾기
                var material = materialModelData.find(function(item) {
                    return item.Uuid === updateInven.MaterialUuid;
                });

                if (!material) {
                    MessageBox.error("Material not found.");
                    return;
                }
            
                var price = material.Price;  // material에서 price 가져오기
                var PaymentAmount = updateInven.MaterialCnt * price;
                var PaymentDescription = '재료 구입(' + updateInven.MaterialName + ') ' + updateInven.MaterialQuantity + updateInven.Qunit + ' * ' + updateInven.MaterialCnt + 'EA';
                newQuantity = currentQuantity + quantityChange*updateInven.MaterialCnt;

            } else {
                console.log(quantityChange);
                newQuantity = currentQuantity - quantityChange
                if (newQuantity < 0) newQuantity = 0;
            }

            updateInven.InventoryQuantity = '' + newQuantity;
            delete updateInven.state;
            delete updateInven.quantity;
            delete updateInven.MaterialName;
            delete updateInven.MaterialQuantity;
            delete updateInven.MaterialCnt;
        
            this._getODataUpdate(oMainModel, "/Inventory(guid'" + updateInven.Uuid + "')", updateInven).done(function(aGetData) {
                if (that.flag) {
                    // 지출내역에 정보 저장
                    that.insertPayment({
                        PaymentDescription: PaymentDescription,
                        PaymentAmount: ''+PaymentAmount
                    });
                    that.refresh(true);
                    that._closeDialog();
                    MessageBox.alert("지출 내역이 입력되었습니다.");
                } else {
                    that._closeDialog();
                    that.refresh();
                }
            }.bind(this)).fail(function() {
                MessageBox.information("Update Fail");
            }).always(function() {
            });
        },

        cartReset: function (){
            this.moveSelectedRow("temporaryModel", "productModel", true);
        },

        moveToTable1: function() {
            // Table2에서 선택된 항목을 Table1로 이동
            this.moveSelectedRow("temporaryModel", "productModel");
        },
        
        moveToTable2: function() {
            // Table1에서 선택된 항목을 Table2로 이동
            this.moveSelectedRow("productModel", "temporaryModel");
        },
        
        moveSelectedRow: function(sourceModelName, targetModelName, resetState=false) {

            var oSourceTable = this.byId(sourceModelName === "productModel" ? "table1" : "table2");
            var oTargetTable = this.byId(targetModelName === "productModel" ? "table1" : "table2");
            var oSourceModel = this.getView().getModel(sourceModelName);
            var oTargetModel = this.getView().getModel(targetModelName);
            var aSourceData = oSourceModel.getData() || [];
            var aTargetData = oTargetModel.getData() || [];
            var aNewItems = [];
            var dataLength;

            var aSelectedIndices = oSourceTable.getSelectedIndices();
            if (aSelectedIndices.length === 0 && !resetState) {
                MessageToast.show("먼저 이동할 항목을 선택하세요.");
                return;
            }

            var dataLength = resetState ? aSourceData.length : aSelectedIndices.length;

            for (var i = dataLength - 1; i >= 0; i--) {
                var iIndex = resetState ? i : aSelectedIndices[i];
                var oSelectedData = aSourceData[iIndex];
                var bExists = aTargetData.some(function(item) {
                    return item.Uuid === oSelectedData.Uuid;
                });
        
                if (!bExists) {
                    aNewItems.unshift(oSelectedData);
                }
                aSourceData.splice(iIndex, 1);
            }

            aNewItems.forEach(function(oNewItem) {
                aTargetData.push({...oNewItem, totalAmount : oNewItem.Price * 1, MaterialCnt : 1});
            });

            this.setModel(new JSONModel(aSourceData), sourceModelName);
            this.setModel(new JSONModel(aTargetData), targetModelName);
 
            var SortOrder = coreLibrary.SortOrder;
            var oProductNameColumn2 = this.getView().byId("table1");
            var oProductNameColumn3 = this.getView().byId("table2");
            this.getView().byId("table1").sort(oProductNameColumn2, SortOrder.Ascending);
            this.getView().byId("table2").sort(oProductNameColumn3, SortOrder.Ascending);

        },

        addInventory: function() {
            var oMainModel = this.getOwnerComponent().getModel();
            var temporaryData = this.getView().getModel("temporaryModel").getData();
        
            if (temporaryData.length <= 0) {
                MessageToast.show("선택하신 상품이 없습니다.");
                return;
            }
        
            var that = this;
            MessageBox.confirm("선택한 재료들을 재고로 추가합니다.", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: async function(sAction) {
                    if (sAction === 'OK') {
                        try {
                            var createPromises = temporaryData.map(function(Material) {
                                var newStock = {
                                    MaterialUuid: Material.Uuid,
                                    InventoryQuantity: '' + Material.MaterialQuantity * Material.MaterialCnt,
                                    Qunit: Material.Qunit
                                };
        
                                return that._getODataCreate(oMainModel, '/Inventory', newStock).then(function(aReturn) {
                                    var PaymentDescription = '재료 구입(' + Material.MaterialName + ') ' + Material.MaterialQuantity + Material.Qunit + ' * ' + Material.MaterialCnt + 'EA';
                                    var PaymentAmount = Material.totalAmount;
                                    return that.insertPayment({
                                        PaymentDescription: PaymentDescription,
                                        PaymentAmount: '' + PaymentAmount
                                    });
                                });
                            });
        
                            await Promise.all(createPromises);
                            that.setModel(new JSONModel([]), 'temporaryModel');
                            MessageBox.alert('지출 내역이 입력되었습니다.');
                            that.refresh(true);
                        } catch (error) {
                            MessageBox.error('지출 내역 입력 중 오류가 발생했습니다: ' + error.message);
                        }
                    }
                },
                dependentOn: this.getView()
            });
        },
        
        //////////////////// PAYMENT ////////////////////
        addPayment: async function(oEvent) {
            try {
                await this.insertPayment();
                MessageBox.alert('지출 내역이 입력되었습니다.');
                this.setModel(new JSONModel({PaymentDescription : undefined, PaymentAmount : undefined}), 'paymentInputModel');
                this.refresh();
            } catch (error) {
                MessageBox.error('지출 내역 입력 중 오류가 발생했습니다: ' + error.message);
            }
        },
        
        insertPayment: function(material) {
            return new Promise((resolve, reject) => {
                var oMainModel = this.getOwnerComponent().getModel('Payment');
                var paymentInput = {};
                if (material) {
                    paymentInput = material;
                } else {
                    paymentInput = this.getModel('paymentInputModel').getData();
                    if (!paymentInput.PaymentDescription || !paymentInput.PaymentAmount) {
                        console.log(paymentInput);
                        MessageBox.alert('지출 상세 내역을 모두 입력 바랍니다.');
                        return reject(new Error('지출 상세 내역이 누락되었습니다.'));
                    }
                }
                console.log(paymentInput);
                
                this._getODataCreate(oMainModel, "/Payment", paymentInput)
                    .done(function(aGetData) {
                        resolve(aGetData);
                    }.bind(this))
                    .fail(function() {
                        MessageBox.information("Read Fail");
                        reject(new Error('지출 내역 입력 실패'));
                    });
            });
        }
    });
});
