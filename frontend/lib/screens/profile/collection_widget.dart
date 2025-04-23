import 'package:flutter/material.dart';
import 'package:frontend/models/collection.dart';
import 'package:frontend/widgets/product_item/catalogue_view.dart';
import 'package:frontend/services/collection/collection_service.dart';

class CollectionWidget extends StatefulWidget {
  final List<CollectionList> collections;
  final Future<List<CollectionItem>> Function(int collectionId) loadItems;

  const CollectionWidget({
    Key? key,
    required this.collections,
    required this.loadItems,
  }) : super(key: key);

  @override
  State<CollectionWidget> createState() => _CollectionWidgetState();
}

class _CollectionWidgetState extends State<CollectionWidget> {
  int? _selectedCollectionId;
  Future<List<CollectionItem>>? _itemsFuture;
  late List<CollectionList> _collections;
  final CollectionService _collectionService = CollectionService();

  @override
  void initState() {
    super.initState();
    print(
      '📦 Initial collections: ${widget.collections.map((c) => c.name).toList()}',
    );
    _collections = List<CollectionList>.from(widget.collections);
  }

  void _selectCollection(int collectionId) {
    print('🟢 Selected collection ID: $collectionId');
    setState(() {
      _selectedCollectionId = collectionId;
      _itemsFuture = widget.loadItems(collectionId);
    });
  }

  void _deselectCollection() {
    setState(() {
      _selectedCollectionId = null;
      _itemsFuture = null;
    });
  }

  void _showAddCollectionDialog() {
    final TextEditingController _controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Create Collection'),
          content: TextField(
            controller: _controller,
            decoration: const InputDecoration(labelText: 'Collection Name'),
            autofocus: true,
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final name = _controller.text.trim();
                if (name.isEmpty) return;
                final newCollection = await _collectionService
                    .createNewCollection(name);
                setState(() {
                  if (newCollection != null) {
                    _collections.add(newCollection);
                  }
                });
                Navigator.of(context).pop();
              },
              child: const Text('Create'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_selectedCollectionId == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4.0, vertical: 1.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Collections', style: const TextStyle(fontSize: 18)),
                IconButton(
                  icon: const Icon(Icons.add),
                  onPressed: _showAddCollectionDialog,
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _collections.length,
              itemBuilder: (context, index) {
                final collection = _collections[index];
                return ListTile(
                  title: Text(collection.name),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _selectCollection(collection.id),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 8.0),
                );
              },
            ),
          ),
        ],
      );
    } else {
      return FutureBuilder<List<CollectionItem>>(
        future: _itemsFuture,
        builder: (context, snapshot) {
          Widget body;
          if (snapshot.connectionState == ConnectionState.waiting) {
            body = const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            print('❌ Error loading collection items: ${snapshot.error}');
            body = Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Text('Failed to load items.'),
              ),
            );
          } else {
            print('📬 Loaded items: ${snapshot.data?.length}');
            body = CatalogueView(items: snapshot.data!);
          }
          final selected = _collections.firstWhere(
            (c) => c.id == _selectedCollectionId,
            orElse: () => _collections.first,
          );
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 4.0,
                  vertical: 1.0,
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left),
                      onPressed: _deselectCollection,
                    ),
                    Text(selected.name, style: const TextStyle(fontSize: 18)),
                  ],
                ),
              ),
              Expanded(child: body),
            ],
          );
        },
      );
    }
  }
}
