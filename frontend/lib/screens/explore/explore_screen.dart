import 'package:flutter/material.dart';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({Key? key}) : super(key: key);

  @override
  _ExplorePageState createState() => _ExplorePageState();
}

class _ExplorePageState extends State<ExploreScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Explore'),
        backgroundColor: Colors.black,
      ),
      backgroundColor: Colors.black,
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Search field
            TextField(
              controller: _searchController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Search products...',
                hintStyle: TextStyle(color: Colors.white54),
                prefixIcon: const Icon(Icons.search, color: Colors.white54),
                filled: true,
                fillColor: Colors.white12,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (value) {
                setState(() {
                  _searchQuery = value.trim();
                });
                // TODO: trigger your search logic here
              },
            ),

            const SizedBox(height: 16),

            // Results / placeholder
            Expanded(
              child:
                  _searchQuery.isEmpty
                      ? const Center(
                        child: Text(
                          'Start typing to explore products',
                          style: TextStyle(color: Colors.white54),
                        ),
                      )
                      : // Replace this with your actual results widget
                      Center(
                        child: Text(
                          'Showing results for "$_searchQuery"',
                          style: const TextStyle(color: Colors.white),
                        ),
                      ),
            ),
          ],
        ),
      ),
    );
  }
}
