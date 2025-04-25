import 'package:flutter/material.dart';
import 'package:frontend/screens/profile/collection_widget.dart';
import 'package:frontend/services/collection/collection_service.dart';
import 'package:frontend/models/collection.dart';

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
        return const Text(
          "Your Likes",
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
        );
      case 2:
        return const Text(
          "Your Cart",
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}
