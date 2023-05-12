import { plainToClass } from 'class-transformer'
export default class DataClassJsonMixin {
  // 将实例序列化为 JSON 字符串
  toJson() {
    return JSON.stringify(this.toDict())
  }

  // 从 JSON 字符串创建类的实例
  static fromJson(jsonString) {
    const jsonObj = JSON.parse(jsonString)
    return this.fromDict(jsonObj)
  }

  // 将实例转换为对象字面量
  toDict() {
    return this.serialize(this)
  }

  // 从对象字面量创建类的实例
  static fromDict(obj) {
    return this.deserialize(obj, this)
  }

  // 自定义对象序列化逻辑
  serialize(obj) {
    const serialized = {}

    for (const [key, value] of Object.entries(obj)) {
      if (value instanceof DataClassJsonMixin) {
        serialized[key] = value.serialize(value)
      } else {
        serialized[key] = value
      }
    }

    return serialized
  }

  // 自定义对象反序列化逻辑
  static deserialize(jsonObj, TargetClass) {
    return plainToClass(TargetClass, jsonObj)
  }
}
