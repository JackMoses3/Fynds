import 'package:flutter/material.dart';
import '../../screens/explore/search_screen.dart';

class ExploreSearchBar extends StatelessWidget {
  const ExploreSearchBar({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const SearchScreen()),
        );
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.grey[100],
          borderRadius: BorderRadius.circular(25),
          border: Border.all(color: Colors.grey[300]!),
        ),
        child: Row(
          children: [
            Icon(Icons.search, color: Colors.grey[600], size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Search products...',
                style: TextStyle(color: Colors.grey[600], fontSize: 16),
              ),
            ),
            Icon(Icons.camera_alt_outlined, color: Colors.grey[600], size: 20),
          ],
        ),
      ),
    );
  }
}
