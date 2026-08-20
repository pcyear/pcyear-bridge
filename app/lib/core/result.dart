/// 通用结果类型：成功携带值，失败携带可读错误信息。
/// 对应插件后端的 try/catch 返回 { ok, message } 风格。
sealed class Result<T> {
  const Result();

  bool get isOk => this is Ok<T>;
  bool get isErr => this is Err<T>;

  T get value {
    if (this is Ok<T>) return (this as Ok<T>).value;
    throw StateError('Result 为错误，无法取值');
  }

  String get error {
    if (this is Err<T>) return (this as Err<T>).message;
    return '';
  }
}

final class Ok<T> extends Result<T> {
  @override
  final T value;
  const Ok(this.value);
}

final class Err<T> extends Result<T> {
  /// 失败原因。注意：基类暴露的是 [Result.error]，此处是承载字段，
  /// 不是对基类成员的覆盖，故不加 @override。
  final String message;
  const Err(this.message);
}

/// 便捷构造
Result<T> ok<T>(T value) => Ok(value);
Result<T> err<T>(String message) => Err(message);
