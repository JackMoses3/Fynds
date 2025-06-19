// lib/screens/explore/explore_screen.dart

import 'package:flutter/material.dart';
import 'package:fynds/services/product_item/search/search_service.dart';
import 'package:image_picker/image_picker.dart';
import 'package:fynds/services/product_item/search/image_search_service.dart';
import 'package:fynds/models/product_item/product_item.dart';
import 'package:fynds/widgets/product_item/product_item.dart'; // Updated import
import 'dart:io';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({Key? key}) : super(key: key);

  @override
  _ExploreScreenState createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  final _searchCtrl = TextEditingController();
  final _picker = ImagePicker();
  final _searchService = SearchService(); // Add search service instance
  bool _isLoading = false;
  List<ProductItem> _products = [];
  bool _hasSearched = false; // Track if user has searched

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  // -----------------TEXT SEARCH - UPDATED TO USE SEARCH-TEXT ENDPOINT-----------------

  Future<void> _doSearch(String query) async {
    if (query.trim().isEmpty) return;

    setState(() {
      _isLoading = true;
      _hasSearched = true;
      _products.clear(); // Clear previous results
    });

    try {
      print('🔍 [ExploreScreen] Starting search for: "$query"');

      // Use the working searchProductsByText method
      final products = await _searchService.searchProductsByText(query.trim());

      print(
        '✅ [ExploreScreen] Search completed, found ${products.length} products',
      );

      setState(() {
        _products = products;
      });

      // Save search term to recent searches
      await _searchService.saveSearchTerm(query.trim());

      // Show success message
      if (products.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Found ${products.length} products for "$query"'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('No products found for "$query"'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      print('❌ [ExploreScreen] Search error: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Search failed: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  // -----------------IMAGE SEARCH-----------------
  Future<void> _pickImage() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder:
          (_) => SafeArea(
            child: Wrap(
              children: [
                ListTile(
                  leading: const Icon(Icons.camera_alt),
                  title: const Text('Take photo'),
                  onTap: () => Navigator.pop(context, ImageSource.camera),
                ),
                ListTile(
                  leading: const Icon(Icons.photo_library),
                  title: const Text('Upload from gallery'),
                  onTap: () => Navigator.pop(context, ImageSource.gallery),
                ),
              ],
            ),
          ),
    );

    if (source == null) return;

    final XFile? xfile = await _picker.pickImage(
      source: source,
      imageQuality: 85,
    );
    if (xfile == null) return;

    final file = File(xfile.path);
    await _doImageEmbedding(file);
  }

  Future<void> _doImageEmbedding(File image) async {
    setState(() => _isLoading = true);

    try {
      final resp = await ImageEmbeddingService().embedImage(image);
      if (resp == null) throw 'No response';

      // At this point you *only* wanted to create the embedding.
      // We'll just toast the result & show it in console.
      debugPrint(
        'Image embedding (${resp.label}) – first 3 dims: ['
        '${resp.embedding.take(3).join(', ')} …]',
      );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('✅ Got ${resp.label} embedding (512 dims)')),
      );
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Image embedding failed: $e')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // -----------------HELPER METHODS-----------------

  void _clearSearch() {
    setState(() {
      _searchCtrl.clear();
      _products.clear();
      _hasSearched = false;
    });
  }

  // -----------------BUILD-----------------

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top + 16;

    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Main content area
          _buildMainContent(),

          // Gradient scrim for search bar readability
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: topInset + 60, // Increased height for better scrim
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.black.withOpacity(0.8), Colors.transparent],
                ),
              ),
            ),
          ),

          // Search bar
          Positioned(
            top: topInset,
            left: 16,
            right: 16,
            child: _buildSearchBar(),
          ),
        ],
      ),
    );
  }

  Widget _buildMainContent() {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: Colors.white),
            SizedBox(height: 16),
            Text('Searching...', style: TextStyle(color: Colors.white70)),
          ],
        ),
      );
    }

    if (_hasSearched && _products.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.white38),
            const SizedBox(height: 16),
            Text(
              'No products found',
              style: TextStyle(
                color: Colors.white70,
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Try a different search term',
              style: TextStyle(color: Colors.white54, fontSize: 14),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _clearSearch,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white24,
                foregroundColor: Colors.white,
              ),
              child: const Text('Try Again'),
            ),
          ],
        ),
      );
    }

    if (_products.isNotEmpty) {
      // Use PageView for vertical scrolling through products (TikTok-style)
      return PageView.builder(
        scrollDirection: Axis.vertical,
        itemCount: _products.length,
        itemBuilder: (context, index) {
          return ProductItemWidget(product: _products[index]);
        },
      );
    }

    // Default state - no search performed
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search, size: 64, color: Colors.white38),
          const SizedBox(height: 16),
          Text(
            'Search for any product',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 18,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Try "yellow tshirt" or "blue jeans"',
            style: TextStyle(color: Colors.white54, fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white12,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white24, width: 1),
      ),
      child: Row(
        children: [
          // Search TextField
          Expanded(
            child: TextField(
              controller: _searchCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Search products...',
                hintStyle: const TextStyle(color: Colors.white60),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                prefixIcon: Icon(
                  Icons.search,
                  color:
                      _searchCtrl.text.isNotEmpty
                          ? Colors.white
                          : Colors.white60,
                ),
              ),
              textInputAction: TextInputAction.search,
              onSubmitted: _doSearch,
              onChanged: (value) {
                setState(() {}); // Rebuild to update prefix icon color
              },
            ),
          ),

          // Clear button (when there's text)
          if (_searchCtrl.text.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.clear, color: Colors.white60),
              onPressed: _clearSearch,
            ),

          // Camera button
          Container(
            margin: const EdgeInsets.only(right: 4),
            child: IconButton(
              icon: const Icon(Icons.camera_alt, color: Colors.white70),
              onPressed: _pickImage,
              tooltip: 'Search by image',
            ),
          ),
        ],
      ),
    );
  }
}
