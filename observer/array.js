import { def } from '../util/index';
/* 保存数组原型 */
const arrayProto = Array.prototype;
/* 增加代理原型 arrayMethods.__proto__ === arrayProto */
export const arrayMethods = Object.create(arrayProto);
/* 被重写的七个数组方法，实际上只改写了三个方法 */
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
];

methodsToPatch.forEach(function (method) {
  /* 保存原生方法 */
  const original = arrayProto[method];
  /* def 方法定义在until文件夹lang文件中，是对Object.defineProperty方法的封装 */
  def(arrayMethods, method, function mutator(...args) {
    /* 调用原生数组方法 */
    const result = original.apply(this, args);
    const ob = this.__ob__;
    let inserted;
    switch (method) {
      /* push、unshift会新增索引，所以要手动observer */
      case 'push':
      case 'unshift':
        inserted = args;
        break;
      /* splice方法，如果传入了第三个参数，也会有索引加入，也要手动observer */
      case 'splice':
        inserted = args.slice(2);
        break;
    }
    /* observeArray方法对 inserted中的元素进行遍历，
      重新进行observe
    */
    if (inserted) ob.observeArray(inserted);
    /* dep通知所有注册的观察者 */
    ob.dep.notify();
    /* 返回原生数组方法的执行结果 */
    return result;
  });
});
