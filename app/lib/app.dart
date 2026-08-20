import 'package:flutter/material.dart';
import 'package:pcyear_bridge/data/player/audio_player_service.dart';
import 'package:pcyear_bridge/data/sources/source_repository.dart';
import 'package:pcyear_bridge/presentation/providers/favorites_provider.dart';
import 'package:pcyear_bridge/presentation/providers/library_provider.dart';
import 'package:pcyear_bridge/presentation/providers/sources_provider.dart';
import 'package:pcyear_bridge/presentation/screens/library_screen.dart';
import 'package:pcyear_bridge/presentation/screens/player_screen.dart';
import 'package:pcyear_bridge/presentation/screens/search_screen.dart';
import 'package:pcyear_bridge/presentation/screens/sources_screen.dart';
import 'package:provider/provider.dart';

class MyApp extends StatelessWidget {
  final SourceRepository repo;
  final AudioPlayerService player;
  final FavoritesProvider favorites;

  const MyApp({
    super.key,
    required this.repo,
    required this.player,
    required this.favorites,
  });

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<SourceRepository>.value(value: repo),
        ChangeNotifierProvider<AudioPlayerService>.value(value: player),
        ChangeNotifierProvider<FavoritesProvider>.value(value: favorites),
        ChangeNotifierProvider<SourcesProvider>(
            create: (_) => SourcesProvider(repo)),
        ChangeNotifierProvider<LibraryProvider>(
            create: (_) => LibraryProvider(repo)),
      ],
      child: MaterialApp(
        title: '多源音乐桥',
        theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.teal),
        home: const HomePage(),
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _tab = 0;
  final _pages = const [
    LibraryScreen(),
    SearchScreen(),
    SourcesScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          Expanded(child: _pages[_tab]),
          const MiniPlayer(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.library_music), label: '乐库'),
          NavigationDestination(icon: Icon(Icons.search), label: '搜索'),
          NavigationDestination(icon: Icon(Icons.storage), label: '音源'),
        ],
      ),
    );
  }
}

/// 底部常驻迷你播放器：展示当前曲目，点击展开播放页
class MiniPlayer extends StatelessWidget {
  const MiniPlayer({super.key});

  @override
  Widget build(BuildContext context) {
    final player = Provider.of<AudioPlayerService>(context);
    final t = player.current;
    if (t == null) return const SizedBox.shrink();
    final subtitle = [t.artist, t.album]
        .where((s) => s != null && s!.isNotEmpty)
        .join(' · ');
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const PlayerScreen()),
      ),
      child: Container(
        // 用 cardColor 而非 colorScheme.surfaceVariant：后者在 Flutter 3.22+ 已废弃，
        // cardColor 在各版本均可用，避免因 SDK 版本差异产生告警。
        color: Theme.of(context).cardColor,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(t.displayTitle,
                      maxLines: 1, overflow: TextOverflow.ellipsis),
                  if (subtitle.isNotEmpty)
                    Text(subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            IconButton(
              icon: Icon(player.isPlaying ? Icons.pause : Icons.play_arrow),
              onPressed: player.toggle,
            ),
          ],
        ),
      ),
    );
  }
}
