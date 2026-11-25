/** 保存最新值，供同一时间只需一个订阅者的组件使用。 */
export function createObservableValue<T>(initialValue: T) {
  let value = initialValue;
  let subscriber: ((value: T) => void) | undefined;

  return {
    get() {
      return value;
    },
    set(nextValue: T) {
      if (Object.is(value, nextValue)) return;
      value = nextValue;
      subscriber?.(value);
    },
    subscribe(callback: (value: T) => void) {
      subscriber = callback;
      callback(value);
      return () => {
        if (subscriber === callback) subscriber = undefined;
      };
    },
  };
}
