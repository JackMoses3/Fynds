import 'package:flutter/material.dart';
import '../../models/product_item/filter.dart';
import '../../widgets/product_feed/infinite_product_feed.dart';
import '../preferences_screen.dart';

class HomeScreen extends StatelessWidget {
  final FilterDto? initialFilters;
  const HomeScreen({Key? key, this.initialFilters}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list, color: Colors.white),
            onPressed: () async {
              final result = await Navigator.push<Map<String, dynamic>>(
                context,
                MaterialPageRoute(
                  builder:
                      (_) => PreferencesScreen(initialFilters: initialFilters),
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
                // Replace with a fresh HomeScreen that has the new filters
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(
                    builder: (_) => HomeScreen(initialFilters: dto),
                  ),
                );
              }
            },
          ),
        ],
      ),
      body: InfiniteProductFeed(initialFilters: initialFilters),
    );
  }
}
