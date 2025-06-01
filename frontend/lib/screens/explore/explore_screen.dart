import 'package:flutter/material.dart';
import 'package:frontend/models/product_item/search.dart';
import 'package:frontend/services/product_item/search/search_service.dart';
import 'package:frontend/models/product_item/product_item.dart';
import 'package:frontend/services/product_item/item/product_item_service.dart';
import 'package:frontend/widgets/product_item/product_item.dart';
import 'dart:ui';
import 'package:frontend/widgets/product_feed/infinite_product_feed.dart';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({Key? key}) : super(key: key);

  @override
  _ExploreScreenState createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  final _searchCtrl = TextEditingController();
  bool _isLoading = false;
  List<ProductItem> _products = [];

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _doSearch(String query) async {
    if (query.isEmpty) return;
    setState(() {
      _isLoading = true;
      _products = [];
    });
    try {
      // 1) text→image → IDs
      final matches = await SearchService().searchMatches(query) ?? [];

      // 2) batch fetch full items
      if (matches.isNotEmpty) {
        final ids = matches.map((m) => m.productId).toList();
        final items = await ProductItemService().getProductItemsByIds(ids);
        setState(
          () => _products = items ?? [],
        ); //update products with all items
      }
    } catch (e) {
      debugPrint('Search error: $e');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Search failed: $e')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top + 16;
    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // if we have search results, render them via the feed
          if (_products.isNotEmpty)
            InfiniteProductFeed(initialProducts: _products)
          else if (_isLoading)
            const Center(child: CircularProgressIndicator(color: Colors.white))
          else
            const Center(
              child: Text(
                'Search above to explore products',
                style: TextStyle(color: Colors.white54),
              ),
            ),

          // gradient scrim for the search box
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: topInset + 40,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.black.withOpacity(0.7), Colors.transparent],
                ),
              ),
            ),
          ),

          // the search bar
          Positioned(
            top: topInset,
            left: 16,
            right: 16,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white12,
                borderRadius: BorderRadius.circular(8),
              ),
              child: TextField(
                controller: _searchCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Search products',
                  hintStyle: const TextStyle(color: Colors.white70),
                  prefixIcon: const Icon(Icons.search, color: Colors.white70),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
                textInputAction: TextInputAction.search,
                onSubmitted: (v) => _doSearch(v.trim()),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
