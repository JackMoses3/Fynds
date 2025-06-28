// lib/screens/explore/explore_screen.dart

import 'package:flutter/material.dart';
import 'package:fynds/services/product_item/search/search_service.dart';
import 'package:fynds/widgets/explore/style_carousel.dart';
import 'package:image_picker/image_picker.dart';
import 'package:fynds/models/product_item/product_item.dart';
import 'package:fynds/widgets/product_item/product_item.dart';
import 'dart:io';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({Key? key}) : super(key: key);

  @override
  _ExploreScreenState createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen>
    with AutomaticKeepAliveClientMixin {
  final _searchCtrl = TextEditingController();
  final _picker = ImagePicker();
  final _searchService = SearchService();
  bool _isLoading = false;
  List<ProductItem> _products = [];
  bool _hasSearched = false;

  @override
  bool get wantKeepAlive => true; // Keep state alive when switching tabs

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
      _products.clear();
    });

    try {
      print('🔍 [ExploreScreen] Starting search for: "$query"');
      final products = await _searchService.searchProductsByText(query.trim());
      print(
        '✅ [ExploreScreen] Search completed, found ${products.length} products',
      );

      setState(() {
        _products = products;
      });

      await _searchService.saveSearchTerm(query.trim());

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
    await _doImageSearch(file);
  }

  Future<void> _doImageSearch(File image) async {
    setState(() => _isLoading = true);

    try {
      print('📷 [ExploreScreen] Starting image search...');
      final products = await _searchService.searchProductsByImage(image);
      print(
        '✅ [ExploreScreen] Image search completed, found ${products.length} products',
      );

      setState(() {
        _products = products;
        _hasSearched = true;
      });

      if (products.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Found ${products.length} similar products!'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('No similar products found.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      print('❌ [ExploreScreen] Image search error: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Image search failed: $e'),
          backgroundColor: Colors.red,
        ),
      );
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
    super.build(context); // Required for AutomaticKeepAliveClientMixin
    final topInset = MediaQuery.of(context).padding.top + 16;

    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor:
          _hasSearched || _products.isNotEmpty
              ? Colors.black
              : Colors.white, // Dynamic background
      body: Stack(
        children: [
          _buildMainContent(),

          // Gradient scrim - only show when in search mode
          if (_hasSearched || _products.isNotEmpty || _isLoading)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: topInset + 60,
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
      return Container(
        color: Colors.black,
        child: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: Colors.white),
              SizedBox(height: 16),
              Text('Searching...', style: TextStyle(color: Colors.white70)),
            ],
          ),
        ),
      );
    }

    if (_hasSearched && _products.isEmpty) {
      return Container(
        color: Colors.black,
        child: Center(
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
        ),
      );
    }

    if (_products.isNotEmpty) {
      return Container(
        color: Colors.black,
        child: PageView.builder(
          scrollDirection: Axis.vertical,
          itemCount: _products.length,
          itemBuilder: (context, index) {
            return ProductItemWidget(product: _products[index]);
          },
        ),
      );
    }

    // Default explore page with style carousel
    return _buildExploreHomePage();
  }

  Widget _buildExploreHomePage() {
    final topInset =
        MediaQuery.of(context).padding.top + 80; // Account for search bar

    return Container(
      color: Colors.white,
      child: SingleChildScrollView(
        padding: EdgeInsets.only(top: topInset + 16, bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Page Title
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'Explore',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 24),

            // Style Carousel
            const StyleCarousel(title: 'EXPLORE STYLES', showTitle: true),
            const SizedBox(height: 32),

            // Shop By Section
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'SHOP BY',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Shop By Tags - Row 1
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _buildShopByChip('Trending'),
                  _buildShopByChip('On Sale'),
                  _buildShopByChip('Last Chance'),
                  _buildShopByChip('Just Dropped'),
                  _buildShopByChip('FYNDS Picks'),
                ],
              ),
            ),
            const SizedBox(height: 8),

            // Shop By Tags - Row 2
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _buildShopByChip('Under \$100'),
                  _buildShopByChip('Back In Stock'),
                  _buildShopByChip('For Her'),
                  _buildShopByChip('For Him'),
                  _buildShopByChip('Airport Look'),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Featured Products Grid (placeholder)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'FEATURED',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Placeholder for featured products grid
            Container(
              height: 400,
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: Text(
                  'Featured products coming soon',
                  style: TextStyle(color: Colors.grey, fontSize: 16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildShopByChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black87,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    // Dynamic styling based on current mode
    final isSearchMode = _hasSearched || _products.isNotEmpty || _isLoading;

    return Container(
      decoration: BoxDecoration(
        color: isSearchMode ? Colors.white12 : Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
        border:
            isSearchMode
                ? Border.all(color: Colors.white24, width: 1)
                : Border.all(color: Colors.grey[300]!, width: 1),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _searchCtrl,
              style: TextStyle(
                color: isSearchMode ? Colors.white : Colors.black87,
              ),
              decoration: InputDecoration(
                hintText: 'Search for anything',
                hintStyle: TextStyle(
                  color: isSearchMode ? Colors.white60 : Colors.grey[600],
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                prefixIcon: Icon(
                  Icons.search,
                  color:
                      _searchCtrl.text.isNotEmpty
                          ? (isSearchMode ? Colors.white : Colors.black87)
                          : (isSearchMode ? Colors.white60 : Colors.grey[600]),
                ),
              ),
              textInputAction: TextInputAction.search,
              onSubmitted: _doSearch,
              onChanged: (value) {
                setState(() {});
              },
            ),
          ),

          if (_searchCtrl.text.isNotEmpty)
            IconButton(
              icon: Icon(
                Icons.clear,
                color: isSearchMode ? Colors.white60 : Colors.grey[600],
              ),
              onPressed: _clearSearch,
            ),

          Container(
            margin: const EdgeInsets.only(right: 4),
            child: IconButton(
              icon: Icon(
                Icons.camera_alt,
                color: isSearchMode ? Colors.white70 : Colors.grey[700],
              ),
              onPressed: _pickImage,
              tooltip: 'Search by image',
            ),
          ),
        ],
      ),
    );
  }
}
