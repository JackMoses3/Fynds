import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io'; // Import for File
import '../../models/product_item/filter.dart';
import '../../models/product_item/product_item.dart';
import '../preferences_screen.dart';
import '../../services/product_item/search/search_service.dart';
import '../../widgets/product_item/product_item.dart'; // Updated import

class SearchScreen extends StatefulWidget {
  const SearchScreen({Key? key}) : super(key: key);

  @override
  _SearchScreenState createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ImagePicker _imagePicker = ImagePicker();
  final SearchService _searchService = SearchService();

  FilterDto? _currentFilters;
  List<String> _recentSearches = [];
  List<ProductItem> _searchResults = [];
  bool _isLoading = false;
  bool _hasSearched = false;

  @override
  void initState() {
    super.initState();
    _loadRecentSearches();
  }

  Future<void> _loadRecentSearches() async {
    final searches = await _searchService.getRecentSearches();
    setState(() {
      _recentSearches = searches;
    });
  }

  Future<void> _saveSearchTerm(String term) async {
    if (term.trim().isNotEmpty) {
      await _searchService.saveSearchTerm(term.trim());
      _loadRecentSearches();
    }
  }

  Future<void> _showImagePicker() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder:
          (context) => SafeArea(
            child: Wrap(
              children: [
                ListTile(
                  leading: const Icon(Icons.photo_camera),
                  title: const Text('Take Photo'),
                  onTap: () async {
                    Navigator.pop(context);
                    final image = await _imagePicker.pickImage(
                      source: ImageSource.camera,
                    );
                    if (image != null) {
                      _handleImageSearch(image);
                    }
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.photo_library),
                  title: const Text('Choose from Gallery'),
                  onTap: () async {
                    Navigator.pop(context);
                    final image = await _imagePicker.pickImage(
                      source: ImageSource.gallery,
                    );
                    if (image != null) {
                      _handleImageSearch(image);
                    }
                  },
                ),
              ],
            ),
          ),
    );
  }

  Future<void> _handleImageSearch(XFile image) async {
    setState(() {
      _isLoading = true;
      _hasSearched = true;
      _searchResults.clear();
      _searchController.text = 'Image Search';
    });

    try {
      final File imageFile = File(image.path);

      final products = await _searchService.searchProductsByImage(
        imageFile,
        filters: _currentFilters,
      );

      setState(() {
        _searchResults = products;
      });

      await _saveSearchTerm(
        'Image Search - ${DateTime.now().toString().substring(0, 16)}',
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Image search failed: ${e.toString()}'),
          backgroundColor: Colors.red[600],
          duration: const Duration(seconds: 4),
        ),
      );
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _showFilters() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder:
            (context) => PreferencesScreen(initialFilters: _currentFilters),
      ),
    );

    if (result != null) {
      setState(() {
        _currentFilters = FilterDto.fromJson(result);
      });
    }
  }

  Future<void> _performSearch() async {
    final searchTerm = _searchController.text.trim();
    if (searchTerm.isEmpty) return;

    setState(() {
      _isLoading = true;
      _hasSearched = true;
      _searchResults.clear();
    });

    try {
      print('🔍 [SearchScreen] Starting search for: "$searchTerm"');

      final products = await _searchService.searchProductsByText(
        searchTerm,
        filters: _currentFilters,
      );

      print(
        '✅ [SearchScreen] Search completed, found ${products.length} products',
      );

      setState(() {
        _searchResults = products;
      });

      await _saveSearchTerm(searchTerm);
    } catch (e) {
      print('❌ [SearchScreen] Search error: $e');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Search failed: $e')));
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _selectRecentSearch(String search) {
    _searchController.text = search;
    _performSearch();
  }

  void _selectSampleSearch(String search) {
    _searchController.text = search;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Search Header
            _buildSearchHeader(),

            // Search Content/Results
            Expanded(
              child:
                  _hasSearched ? _buildSearchResults() : _buildSearchContent(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchHeader() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            spreadRadius: 1,
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        children: [
          // First Row - Search Product + Camera
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.grey[50],
                    borderRadius: BorderRadius.circular(25),
                    border: Border.all(color: Colors.grey[300]!),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.search, color: Colors.grey[600], size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          decoration: const InputDecoration(
                            hintText: 'Search products...',
                            border: InputBorder.none,
                            isDense: true,
                          ),
                          textInputAction: TextInputAction.search,
                          onSubmitted: (_) => _performSearch(),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              GestureDetector(
                onTap: _showImagePicker,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.blue[50],
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.blue[200]!),
                  ),
                  child: Icon(
                    Icons.camera_alt,
                    color: Colors.blue[600],
                    size: 24,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Second Row - Filter + Cancel + Search
          Row(
            children: [
              // Filter Button
              GestureDetector(
                onTap: _showFilters,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color:
                        _currentFilters != null
                            ? Colors.blue[50]
                            : Colors.grey[100],
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color:
                          _currentFilters != null
                              ? Colors.blue[300]!
                              : Colors.grey[300]!,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.tune,
                        size: 16,
                        color:
                            _currentFilters != null
                                ? Colors.blue[600]
                                : Colors.grey[600],
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Filter',
                        style: TextStyle(
                          color:
                              _currentFilters != null
                                  ? Colors.blue[600]
                                  : Colors.grey[600],
                          fontSize: 14,
                        ),
                      ),
                      if (_currentFilters != null) ...[
                        const SizedBox(width: 4),
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: Colors.blue[600],
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              const Spacer(),

              // Cancel Button
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  'Cancel',
                  style: TextStyle(color: Colors.grey[600], fontSize: 16),
                ),
              ),

              const SizedBox(width: 8),

              // Search Button
              ElevatedButton(
                onPressed: _performSearch,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue[600],
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(25),
                  ),
                ),
                child:
                    _isLoading
                        ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                          ),
                        )
                        : const Text('Search'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSearchContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Try Searching Section
          _buildTrySearchingSection(),

          const SizedBox(height: 32),

          // Recent Searches Section
          _buildRecentSearchesSection(),
        ],
      ),
    );
  }

  Widget _buildSearchResults() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_searchResults.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No products found',
              style: TextStyle(
                fontSize: 18,
                color: Colors.grey[600],
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Try adjusting your search or filters',
              style: TextStyle(fontSize: 14, color: Colors.grey[500]),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _hasSearched = false;
                  _searchController.clear();
                });
              },
              child: const Text('Try Again'),
            ),
          ],
        ),
      );
    }

    // Use PageView for swiping through results (like TikTok/Instagram Reels)
    return PageView.builder(
      scrollDirection: Axis.vertical,
      itemCount: _searchResults.length,
      itemBuilder: (context, index) {
        return ProductItemWidget(product: _searchResults[index]);
      },
    );
  }

  Widget _buildTrySearchingSection() {
    final sampleSearches = [
      'Red summer dress',
      'Nike sneakers',
      'Yellow tshirt',
      'Blue jeans',
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Try searching',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children:
              sampleSearches.map((search) {
                return GestureDetector(
                  onTap: () => _selectSampleSearch(search),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.grey[100],
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.grey[300]!),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.search, size: 16, color: Colors.grey[600]),
                        const SizedBox(width: 8),
                        Text(
                          search,
                          style: TextStyle(
                            color: Colors.grey[700],
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
        ),
      ],
    );
  }

  Widget _buildRecentSearchesSection() {
    if (_recentSearches.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Recent searches',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
            ),
            TextButton(
              onPressed: () async {
                await _searchService.clearRecentSearches();
                _loadRecentSearches();
              },
              child: Text(
                'Clear',
                style: TextStyle(color: Colors.grey[600], fontSize: 14),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _recentSearches.length,
          separatorBuilder: (context, index) => const Divider(height: 1),
          itemBuilder: (context, index) {
            final search = _recentSearches[index];
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.history, color: Colors.grey[500], size: 20),
              title: Text(
                search,
                style: const TextStyle(fontSize: 16, color: Colors.black87),
              ),
              trailing: IconButton(
                icon: Icon(Icons.close, color: Colors.grey[500], size: 18),
                onPressed: () async {
                  await _searchService.removeSearchTerm(search);
                  _loadRecentSearches();
                },
              ),
              onTap: () => _selectRecentSearch(search),
            );
          },
        ),
      ],
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}
