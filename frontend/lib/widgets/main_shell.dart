import 'package:flutter/material.dart';
import 'package:fynds/screens/home/home_screen.dart';
import 'package:fynds/screens/explore/explore_screen.dart';
import 'package:fynds/screens/basket/basket_screen.dart';
import 'package:fynds/screens/profile/profile_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({Key? key}) : super(key: key);

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;

  static final List<Widget> _pages = <Widget>[
    const HomeScreen(),
    const ExploreScreen(),
    const BasketScreen(),
    const ProfileScreen(),
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _pages[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: _onItemTapped,
        backgroundColor: Colors.white, // white background
        selectedItemColor: Colors.black, // black for selected icon & text
        unselectedItemColor: Colors.black45, // lighter black for unselected
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(
            icon: Icon(Icons.grid_view),
            label: 'Explore',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.shopping_bag),
            label: 'Basket',
          ),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
