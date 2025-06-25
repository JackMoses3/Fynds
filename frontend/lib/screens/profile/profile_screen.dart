import 'package:flutter/material.dart';
import 'package:fynds/screens/profile/collection_widget.dart';
import 'package:fynds/services/collection/collection_service.dart';
import 'package:fynds/models/collection.dart';
import 'package:fynds/services/like/like_service.dart' as like_service;
import 'package:fynds/widgets/product_item/catalogue_view.dart'
    as catalogue_view;
import 'package:fynds/models/product_item/product_item.dart';
import 'package:fynds/screens/basket/basket_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final CollectionService _collectionService = CollectionService();
  List<CollectionList>? _collections;
  bool _isLoadingCollections = true;

  // _selected section is used to determine which section of the profile screen is currently selected
  int _selectedSection = 0;
  String _userName = 'Jack';
  String _email = 'mosesjack@gmail.com';
  List<String> _userStyles = [];

  @override
  void initState() {
    super.initState();
    _loadCollections();
  }

  Future<void> _loadCollections() async {
    final cols = await _collectionService.getCollections();
    setState(() {
      _collections = cols;
      _isLoadingCollections = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _userName,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.black,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _email,
                    style: const TextStyle(fontSize: 16, color: Colors.black),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children:
                        _userStyles
                            .map((style) => Chip(label: Text(style)))
                            .toList(),
                  ),
                  const SizedBox(height: 16),

                  const Divider(height: 32, thickness: 1.2),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  IconButton(
                    icon: Icon(
                      Icons.bookmark,
                      color: _selectedSection == 0 ? Colors.blue : Colors.grey,
                    ),
                    tooltip: 'collections',
                    onPressed: () {
                      setState(() {
                        _selectedSection = 0;
                      });
                    },
                  ),
                  IconButton(
                    icon: Icon(
                      Icons.favorite,
                      color: _selectedSection == 1 ? Colors.blue : Colors.grey,
                    ),
                    tooltip: 'Likes',
                    onPressed: () {
                      setState(() {
                        _selectedSection = 1;
                      });
                    },
                  ),
                  IconButton(
                    icon: Icon(
                      Icons.shopping_cart,
                      color: _selectedSection == 2 ? Colors.blue : Colors.grey,
                    ),
                    tooltip: 'Cart',
                    onPressed: () {
                      setState(() {
                        _selectedSection = 2;
                      });
                    },
                  ),
                ],
              ),
              const Divider(height: 32, thickness: 1.2),
              Expanded(child: Center(child: _buildSectionContent())),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionContent() {
    switch (_selectedSection) {
      case 0:
        if (_isLoadingCollections) {
          return const Center(child: CircularProgressIndicator());
        }
        return CollectionWidget(
          collections: _collections!,
          loadItems:
              (collectionId) =>
                  _collectionService.getCollectionById(collectionId),
        );
      case 1:
        return FutureBuilder<List<ProductItem>>(
          future: like_service.LikeService().getLikedProducts(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            } else if (snapshot.hasError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Text('Failed to load liked items.'),
                ),
              );
            } else {
              final data = snapshot.data ?? [];
              final items =
                  data.where((p) => p.images.isNotEmpty).toList()
                    ..sort((a, b) => b.id.compareTo(a.id));
              if (items.isEmpty) {
                return const Center(child: Text('No liked items.'));
              }
              return catalogue_view.CatalogueView(items: items);
            }
          },
        );
      case 2:
        return const BasketScreen();
      default:
        return const SizedBox.shrink();
    }
  }
}
