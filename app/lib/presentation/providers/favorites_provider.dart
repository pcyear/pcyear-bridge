import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pcyear_bridge/core/models.dart';

const String _kFav = 'fnmusic_favorites';

/// 本地收藏（持久化到 shared_preferences）。对应插件「收藏」。
class FavoritesProvider extends ChangeNotifier {
  List<Track> _favorites = [];

  List<Track> get favorites => List.unmodifiable(_favorites);

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_kFav);
    if (raw != null) {
      _favorites = (jsonDecode(raw) as List)
          .map((e) => Track.fromJson(e as Map<String, dynamic>))
          .toList();
      notifyListeners();
    }
  }

  bool isFavorite(String id) => _favorites.any((t) => t.id == id);

  Future<void> toggle(Track t) async {
    if (isFavorite(t.id)) {
      _favorites.removeWhere((x) => x.id == t.id);
    } else {
      _favorites.add(t);
    }
    await _persist();
    notifyListeners();
  }

  /// 批量移出收藏（对应插件批量栏的「移出收藏」）
  Future<void> removeMany(Iterable<String> ids) async {
    final set = ids.toSet();
    if (set.isEmpty) return;
    _favorites.removeWhere((t) => set.contains(t.id));
    await _persist();
    notifyListeners();
  }

  Future<void> clear() async {
    if (_favorites.isEmpty) return;
    _favorites = [];
    await _persist();
    notifyListeners();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
        _kFav, jsonEncode(_favorites.map((t) => t.toJson()).toList()));
  }
}
