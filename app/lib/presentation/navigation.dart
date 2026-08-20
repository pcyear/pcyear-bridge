import 'package:flutter/material.dart';
import 'package:pcyear_bridge/presentation/screens/collection_tracks_screen.dart';
import 'package:provider/provider.dart';

/// 页面跳转的公共入口。
///
/// 单独成文件是为了打断「乐库页 ↔ 收藏页 ↔ 搜索页」之间的循环 import：
/// 各页面只依赖本模块，不互相依赖。
///
/// 其中 `playAndOpen` 来自 [play_launch]（叶子模块，不依赖任何页面），
/// 通过 `export` 在此一并暴露，调用方只需 `import 'navigation.dart'`
/// 即可同时拿到 `openCollection` 与 `playAndOpen`。
export 'play_launch.dart';

/// 打开专辑 / 艺术家详情。
/// [sourceId] 为空说明该条目缺少归属音源，给出提示而不是崩在 `!` 断言上。
void openCollection(
  BuildContext context, {
  required String? sourceId,
  required String id,
  required String title,
  required bool isArtist,
}) {
  if (sourceId == null || sourceId.isEmpty) {
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('该条目缺少音源信息，无法打开')));
    return;
  }
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => CollectionTracksPage(
        sourceId: sourceId,
        collectionId: id,
        title: title,
        isArtist: isArtist,
      ),
    ),
  );
}
