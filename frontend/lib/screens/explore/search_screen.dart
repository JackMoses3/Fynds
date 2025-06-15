import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../models/product_item/filter.dart';
import '../preferences_screen.dart';
import '../../services/explore/search_service.dart';

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
  bool _isLoading = false;

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

  void _handleImageSearch(XFile image) {
    // Handle image search logic here
    // You can navigate to search results or process the image
    print('Image selected: ${image.path}');
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

  void _performSearch() {
    final searchTerm = _searchController.text.trim();
    if (searchTerm.isNotEmpty) {
      _saveSearchTerm(searchTerm);
      // Navigate to search results page or perform search
      // You can pass both searchTerm and _currentFilters to results page
      print('Searching for: $searchTerm with filters: $_currentFilters');
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

            // Search Content
            Expanded(
              child: SingleChildScrollView(
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
              ),
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
                child: const Text('Search'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTrySearchingSection() {
    final sampleSearches = ['Red summer dress', 'Nike sneakers under \$100'];

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
