import 'package:flutter/material.dart';
import 'package:pcyear_bridge/app.dart';
import 'package:pcyear_bridge/data/player/audio_player_service.dart';
import 'package:pcyear_bridge/data/sources/source_repository.dart';
import 'package:pcyear_bridge/presentation/providers/favorites_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final repo = SourceRepository();
  await repo.init();
  final player = AudioPlayerService(repo: repo);
  await player.init();
  final favorites = FavoritesProvider();
  await favorites.init();
  runApp(MyApp(repo: repo, player: player, favorites: favorites));
}
