import 'package:flutter/material.dart';
import '../../models/product_item/filter.dart';
import '../../widgets/product_feed/infinite_product_feed.dart';
import '../preferences_screen.dart';

class HomeScreen extends StatefulWidget {
  final FilterDto? initialFilters;
  const HomeScreen({Key? key, this.initialFilters}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with AutomaticKeepAliveClientMixin {
  FilterDto? _currentFilters;

  @override
  bool get wantKeepAlive => true; // Keep this screen alive when switching tabs

  @override
  void initState() {
    super.initState();
    _currentFilters = widget.initialFilters;
  }

  void _openPreferences() async {
    final result = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(
        builder: (_) => PreferencesScreen(initialFilters: _currentFilters),
      ),
    );

    if (result != null) {
      final dto = FilterDto(
        categories:
            result['categories'] != null
                ? List<String>.from(result['categories'])
                : null,
        brands:
            result['brands'] != null
                ? List<String>.from(result['brands'])
                : null,
        retailers:
            result['retailers'] != null
                ? List<String>.from(result['retailers'])
                : null,
        minPrice: result['minPrice'] as int?,
        maxPrice: result['maxPrice'] as int?,
      );

      // Update the current filters and rebuild the feed
      setState(() {
        _currentFilters = dto;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // Required for AutomaticKeepAliveClientMixin

    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list, color: Colors.white),
            onPressed: _openPreferences,
          ),
        ],
      ),
      body: InfiniteProductFeed(
        key: ValueKey(_currentFilters), // Force rebuild when filters change
        initialFilters: _currentFilters,
      ),
    );
  }
}
