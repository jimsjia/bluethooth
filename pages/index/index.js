const app = getApp()
var tsc = require('../../js/tsc.js');
var util = require('../../utils/util.js');
var time = 0;
var imageData = [];
var k = 0;
var strArray;

function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}



// ArrayBuffer转16进度字符串示例
function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function(bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}

function strToBinary(str) {
  var result = [];
  var list = str.split("");
  for (var i = 0; i < list.length; i++) {
    if (i != 0) {
      result.push(" ");
    }
    var item = list[i];
    var binaryStr = item.charCodeAt().toString(2);
    if (binaryStr) {
      result.push(binartStr);
    }
  }
  return result.join("");
}

Page({
  data: {
    devices: [],
    connected: false,
    chs: [],
  },
  //初始化蓝牙模块
  openBluetoothAdapter() {
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('openBluetoothAdapter success', res)
        this.startBluetoothDevicesDiscovery()
      },
      fail: (res) => {
        if (res.errCode === 10001) {
          wx.onBluetoothAdapterStateChange(function(res) {
            console.log('onBluetoothAdapterStateChange', res)
            if (res.available) {
              this.startBluetoothDevicesDiscovery()
            }
          })
        }
      }
    })
  },
  //获取本机蓝牙适配器状态
  getBluetoothAdapterState() {
    wx.getBluetoothAdapterState({
      success: (res) => {
        console.log('getBluetoothAdapterState', res)
        if (res.discovering) {
          this.onBluetoothDeviceFound()
        } else if (res.available) {
          this.startBluetoothDevicesDiscovery()
        }
      },
      fail: (res) => {
        console.log('error:getBluetoothAdapterState', res)
      }
    })
  },
  //开始搜寻附近的蓝牙外围设备
  startBluetoothDevicesDiscovery() {
    if (this._discoveryStarted) {
      return
    }
    this._discoveryStarted = true
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      success: (res) => {
        console.log('startBluetoothDevicesDiscovery success', res)
        this.onBluetoothDeviceFound()
      },
      fail: (res) => {
        console.log("搜索蓝牙失败");
      }
    })
  },
  stopBluetoothDevicesDiscovery() {
    wx.stopBluetoothDevicesDiscovery()
  },

  //寻找到新设备的事件的回调函数
  onBluetoothDeviceFound() {
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach(device => {
        if (!device.name && !device.localName) {
          return
        }
        const foundDevices = this.data.devices
        const idx = inArray(foundDevices, 'deviceId', device.deviceId)
        const data = {}
        if (idx === -1) {
          data[`devices[${foundDevices.length}]`] = device
        } else {
          data[`devices[${idx}]`] = device
        }
        this.setData(data)
      })
    })
  },

  //连接低功耗蓝牙设备
  createBLEConnection(e) {

    const ds = e.currentTarget.dataset
    const deviceId = ds.deviceId
    const name = ds.name
    wx.createBLEConnection({
      deviceId,
      success: (res) => {
        this.setData({
          connected: true,
          name,
          deviceId,
        })
        this.getBLEDeviceServices(deviceId)
      },
      fail: (res) => {
        console.log("蓝牙连接失败:", res);
      }
    })
    this.stopBluetoothDevicesDiscovery()
  },

  //获取蓝牙设备所有服务(service)
  getBLEDeviceServices(deviceId) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        for (let i = 0; i < res.services.length; i++) {
          if (res.services[i].isPrimary) {
            this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid)
            return
          }
        }
      },
      fail: (res) => {
        console.log("获取蓝牙服务失败：" + JSON.stringify(res))
      }
    })
  },
  //获取蓝牙设备某个服务中所有特征值(characteristic)
  getBLEDeviceCharacteristics(deviceId, serviceId) {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('getBLEDeviceCharacteristics success', res.characteristics)
        for (let i = 0; i < res.characteristics.length; i++) {
          let item = res.characteristics[i]
          if (item.properties.read) {
            wx.readBLECharacteristicValue({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
            })
          }
          if (item.properties.write) {
            this.setData({
              canWrite: true
            })
            this._deviceId = deviceId
            this._serviceId = serviceId
            this._characteristicId = item.uuid
            // this.writeBLECharacteristicValue()
          }
          if (item.properties.notify || item.properties.indicate) {
            wx.notifyBLECharacteristicValueChange({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
              state: true,
            })
          }
        }
      },
      fail(res) {
        console.error('获取特征值失败：', res)
      }
    })
    // 操作之前先监听，保证第一时间获取数据
    wx.onBLECharacteristicValueChange((characteristic) => {
      const idx = inArray(this.data.chs, 'uuid', characteristic.characteristicId)
      const data = {}
      if (idx === -1) {
        data[`chs[${this.data.chs.length}]`] = {
          uuid: characteristic.characteristicId,
          value: ab2hex(characteristic.value)
        }
      } else {
        data[`chs[${idx}]`] = {
          uuid: characteristic.characteristicId,
          value: ab2hex(characteristic.value)
        }
      }
      // data[`chs[${this.data.chs.length}]`] = {
      //   uuid: characteristic.characteristicId,
      //   value: ab2hex(characteristic.value)
      // }
      this.setData(data)
    })
  },

  senBlData(deviceId, serviceId, characteristicId, uint8Array) {
    console.log('************deviceId = [' + deviceId + ']  serviceId = [' + serviceId + '] characteristics=[' + characteristicId + "]")
    var uint8Buf = Array.from(uint8Array);

    function split_array(datas, size) {
      var result = {};
      var j = 0
      for (var i = 0; i < datas.length; i += size) {
        result[j] = datas.slice(i, i + size)
        j++
      }
      // console.log(result)
      return result
    }
    var sendloop = split_array(uint8Buf, 20);
    // console.log(sendloop.length)
    function realWriteData(sendloop, i) {
      var data = sendloop[i]
      if (typeof(data) == "undefined") {
        return
      }
      // console.log("第【" + i + "】次写数据" + data)
      var buffer = new ArrayBuffer(data.length)
      var dataView = new DataView(buffer)
      for (var j = 0; j < data.length; j++) {
        dataView.setUint8(j, data[j]);
      }
      wx.writeBLECharacteristicValue({
        deviceId,
        serviceId,
        characteristicId,
        value: buffer,
        success(res) {
          realWriteData(sendloop, i + 1);
        }
      })
    }
    var i = 0;
    realWriteData(sendloop, i);
  },
  senBleLabel() {
    //标签模式
    // TSCObj.setText("a", "b", "c", "d", "e", "f", "g");
    // a：字符串，文字X方向起始点，以点表示。
    // b：字符串，文字Y方向起始点，以点表示。
    // c：內建字型名称，共12种（1:  8 * 12 dots 2:  12 * 20 dots 3:  16 * 24 dots 4:  24 * 32 dots 5:  32 * 48 dots TST24.BF2:  繁體中文 24 * 24 TST16.BF2:  繁體中文 16 * 16 TTT24.BF2:  繁體中文 24 * 24 (電信碼) TSS24.BF2:  簡體中文 24 * 24 TSS16.BF2:  簡體中文 16 * 16 K:  韓文 24 * 24 L:  韓文 16 * 16 ）
    // d：字符串，旋转角度
    // e：字符串，X方向放大倍率1 - 8
    // f：字符串，Y方向放大倍率1 - 8
    // g：字符串，打印内容
    // ActiveXwindowsfont(a, b, c, d, e, f, g, h)
    // 说明：使用Windows TTF字体打印文字。
    // 参数：
    // a：整数类型，文字X方向起始点，以点表示。
    // b：整数类型，文字Y方向起始点，以点表示。
    // c：整数类型，字体高度，以点表示。
    // d：整数类型，旋转角度，逆时针方向旋转。0 - 旋转0°，90 - 旋转90°，180 - 旋转180°，270 - 旋转270°。
    // e：整数类型，字体外形。0：标签；1：斜体；2：粗体；3：粗斜体。
    // f：整数类型，下划线，0：无下划线；1：加下划线。
    // g：字符串类型，字体名称。如：Arial，Times new Roman。
    // h：字符串类型，打印文字内容。

    let deviceId = this._deviceId;
    let serviceId = this._serviceId;
    let characteristicId = this._characteristicId;
    var command = tsc.jpPrinter.createNew()
    var data=[]
    data = [{ '0': '品牌：xxx' }, { '1': '品名：未来风衣' }, { '2': 'xxxxxx111' }, { '3': '尺码：L' }, { '4': '面料：35%纳米，65%黄金' }, { '5': '里料：100%皮革' }, { '6': '等级：合格品' }, { '7': '检验员：xxx' }, { '8': '执行标准：xxxx' }, { '9': '安全技术类别：B类' }, { '10': '产地：火星' }, { '11': '洗涤方式：自清洁' }, { '12': '统一零售价：RMB 99999.00' }, { '13': 'xxxxxx111' }]
    command.setSize(40, 80)
    command.setGap(2)
    command.setCls()
    command.setText(100, 20, "TSS24.BF2", 2, 2, "合格证")
    //循环输出条码项目
    for(var i=0;i<data.length-2;i++){
      command.setText(20, (90 + (30 * i)), "TSS24.BF2", 1, 1, data[i][i])
    }
    //最后的售价和条码固定在底部，单独列出
    command.setText(20, 530, "TSS24.BF2", 1, 1, data[data.length - 2][data.length - 2])
    command.setBar(96, 564, "128M", 48, 0, 1, 2, data[data.length - 1][data.length - 1])
    command.setPagePrint()
    this.senBlData(deviceId, serviceId, characteristicId, command.getData())
  },
  
  //断开与低功耗蓝牙设备的连接
  closeBLEConnection() {
    wx.closeBLEConnection({
      deviceId: this.data.deviceId
    })
    this.setData({
      connected: false,
      chs: [],
      canWrite: false,
    })
  },
  //关闭蓝牙模块
  closeBluetoothAdapter() {
    wx.closeBluetoothAdapter()
    this._discoveryStarted = false
  }
})