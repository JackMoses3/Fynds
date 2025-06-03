// lib/screens/explore/explore_screen.dart

import 'package:flutter/material.dart';
import 'package:fynds/services/product_item/search/search_service.dart'; // <-- import the new method
import 'package:image_picker/image_picker.dart'; // NEW
import 'package:fynds/services/product_item/search/image_search_service.dart'; // NEW
import 'package:fynds/models/product_item/product_item.dart';
import 'package:fynds/widgets/product_feed/infinite_product_feed.dart';
import 'dart:io';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({Key? key}) : super(key: key);

  @override
  _ExploreScreenState createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  final _searchCtrl = TextEditingController();
  final _picker = ImagePicker();
  bool _isLoading = false;
  List<ProductItem> _products = [];

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  // -----------------text search-----------------

  Future<void> _doSearch(String query) async {
    if (query.isEmpty) return;

    setState(() {
      _isLoading = true;
    });

    try {
      // 1) Send “query” to NestJS → get back a 512-dim embedding array
      final embedding = await SearchService().getTextEmbedding(query);

      // 2) For now: just show how many dimensions we got
      debugPrint(
        'SearchService.getTextEmbedding returned ${embedding.length} dims; '
        'first three: [${embedding.take(3).join(', ')}]',
      );

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Received embedding with ${embedding.length} dims'),
        ),
      );
    } catch (e) {
      debugPrint('Error obtaining text embedding: $e');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Search failed: $e')));
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  // -----------------image search-----------------
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
      // We’ll just toast the result & show it in console.
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

  // -----------------BUILD-----------------

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top + 16;

    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          if (_products.isNotEmpty)
            InfiniteProductFeed(initialProducts: _products)
          else if (_isLoading)
            const Center(child: CircularProgressIndicator(color: Colors.white))
          else
            const Center(
              child: Text(
                'Search for any product',
                style: TextStyle(color: Colors.white54),
              ),
            ),

          // scrim to make the search box readable
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

          // search bar
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
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  prefixIcon: const Icon(Icons.search, color: Colors.white70),
                  // NEW → camera icon on the RIGHT
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.camera_alt, color: Colors.white70),
                    onPressed: _pickImage,
                  ),
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
