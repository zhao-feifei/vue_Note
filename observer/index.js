/* @flow */

import Dep from './dep';
import VNode from '../vdom/vnode';
import { arrayMethods } from './array';
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering,
} from '../util/index';

const arrayKeys = Object.getOwnPropertyNames(arrayMethods);

/* 标识，避免重复对value进行Observer */
export let shouldObserve: boolean = true;

export function toggleObserving(value: boolean) {
  shouldObserve = value;
}

/*  */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number;

  constructor(value: any) {
    this.value = value;
    this.dep = new Dep();
    this.vmCount = 0;
    /* 让对象的__ob__属性指向Observer实例，这样
    每一层的对象都有 __ob__属性，obj: { arr: [...] }就会变为obj: { arr: [..., __ob__: {} ], __ob__: {} }*/
    def(value, '__ob__', this);
    if (Array.isArray(value)) {
      /* 如果是数组，用修改后的数组方法替换掉原生方法，如果用户浏览器支持__proto__属性，则直接覆盖当前数组对象原型上的原生数组方法，如果不支持，则直接覆盖数组对象的原型 */
      if (hasProto) {
        protoAugment(value, arrayMethods);
      } else {
        copyAugment(value, arrayMethods, arrayKeys);
      }
      this.observeArray(value);
    } else {
      /* 如果是对象，调用walk方法进行响应式处理 */
      this.walk(value);
    }
  }
  /* walk方法传入一个对象，遍历此对象的每一个属性并进行defineReactive绑定 */
  walk(obj: Object) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i]);
    }
  }

  /* 对数组的每一个成员进行observe */
  observeArray(items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i]);
    }
  }
}

/* 下面这个两个 */
function protoAugment(target, src: Object) {
  target.__proto__ = src;
}

function copyAugment(target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];
    def(target, key, src[key]);
  }
}

/**
 * 创建一个Observer实例（__ob__），如果成功创建Observer实例则返回新的Observer实例，如果已有Observer实例则返回现有的Observer实例。
 */
export function observe(value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return;
  }
  let ob: Observer | void;
  /* 通过 __ob__属性判断是否已经有Observer实例*/
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__;
  } else if (
    /* 确保value是对象 */
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    /* 如果没有Observer实例就new一个新的 */
    ob = new Observer(value);
  }
  if (asRootData && ob) {
    ob.vmCount++;
  }
  return ob;
}

/**
 * Define a reactive property on an Object.
 */
export function defineReactive(
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  /* 在闭包中定义dep对象 */
  const dep = new Dep();

  const property = Object.getOwnPropertyDescriptor(obj, key);
  /* 如果没有key属性或者此属性是不可配置的，直接返回*/
  if (property && property.configurable === false) {
    return;
  }

  /* 取出预设的getter/setter */
  const getter = property && property.get;
  const setter = property && property.set;
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key];
  }
  /* 子对象递归进行observe */
  let childOb = !shallow && observe(val);
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      const value = getter ? getter.call(obj) : val;
      if (Dep.target) {
        /* 依赖收集 */
        dep.depend();
        if (childOb) {
          /* 子对象依赖收集 */
          childOb.dep.depend();
          if (Array.isArray(value)) {
            /* 对数组的每个成员进行依赖收集 */
            dependArray(value);
          }
        }
      }
      return value;
    },
    set: function reactiveSetter(newVal) {
      /* 通过getter方法获取当前值，如果和新值一样则直接返回*/
      const value = getter ? getter.call(obj) : val;
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return;
      }
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter();
      }
      /* 这行代码没整明白 */
      if (getter && !setter) return;
      /* 如果原本有setter方法则执行，没有则覆盖旧值 */
      if (setter) {
        setter.call(obj, newVal);
      } else {
        val = newVal;
      }
      /* 新值重新进行observe，保证响应式 */
      childOb = !shallow && observe(newVal);
      /* 通知所有观察者 */
      dep.notify();
    },
  });
}

/**
 * vue.$set方法，用于添加响应式数据
 */
export function set(target: Array<any> | Object, key: any, val: any): any {
  if (
    process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(
      `Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`
    );
  }

  /* 如果目标值是数组，并且key为有效的数组索引 */
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    /* 对比数组的key值和数组长度，取较大值设置为数组的长度 */
    target.length = Math.max(target.length, key);
    /* 替换目标值 */
    target.splice(key, 1, val);
    return val;
  }

  /* 如果目标值是对象，key值有效并且不是原型上的key值 */
  if (key in target && !(key in Object.prototype)) {
    target[key] = val;
    return val;
  }
  /* 获取target的Observer实例 */
  const ob = (target: any).__ob__;
  /*
    _isVue是标识vm实例自身被观察的标志位 ，_isVue为true则代表vm实例
    vmCount判断是否为根节点，存在则代表是data的根节点，Vue 不允许在已经创建的实例上动态添加新的根级响应式属性
  */
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' &&
      warn(
        'Avoid adding reactive properties to a Vue instance or its root $data ' +
          'at runtime - declare it upfront in the data option.'
      );
    return val;
  }

  if (!ob) {
    target[key] = val;
    return val;
  }
  defineReactive(ob.value, key, val);
  ob.dep.notify();
  return val;
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del(target: Array<any> | Object, key: any) {
  if (
    process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(
      `Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`
    );
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1);
    return;
  }
  const ob = (target: any).__ob__;
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' &&
      warn(
        'Avoid deleting properties on a Vue instance or its root $data ' +
          '- just set it to null.'
      );
    return;
  }
  if (!hasOwn(target, key)) {
    return;
  }
  delete target[key];
  if (!ob) {
    return;
  }
  ob.dep.notify();
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i];
    e && e.__ob__ && e.__ob__.dep.depend();
    if (Array.isArray(e)) {
      dependArray(e);
    }
  }
}
