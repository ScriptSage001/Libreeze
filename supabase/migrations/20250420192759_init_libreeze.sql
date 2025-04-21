-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Libraries table
CREATE TABLE IF NOT EXISTS libraries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Books table (centralized catalog)
CREATE TABLE IF NOT EXISTS books (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  isbn VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  publisher VARCHAR(255),
  category VARCHAR(100), -- Book, Magazine, Booklet, etc.
  genre VARCHAR(100),
  published_on DATE,
  language VARCHAR(50),
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on ISBN for faster lookups
CREATE INDEX idx_books_isbn ON books(isbn);

-- Authors table
CREATE TABLE IF NOT EXISTS authors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for books <-> authors
CREATE TABLE IF NOT EXISTS book_authors (
  book_id UUID REFERENCES books ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES authors ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (book_id, author_id)
);

-- Junction table for books <-> compilers
CREATE TABLE IF NOT EXISTS book_compilers (
  book_id UUID REFERENCES books ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES authors ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (book_id, author_id)
);

-- Library books (individual physical/digital inventory)
CREATE TABLE IF NOT EXISTS library_books (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  book_id UUID REFERENCES books ON DELETE CASCADE NOT NULL,
  library_id UUID REFERENCES libraries ON DELETE CASCADE NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  location VARCHAR(255), -- optional: rack or shelf number
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Library users table (extends Supabase auth users)
CREATE TABLE IF NOT EXISTS library_users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  profile_photo_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  library_id UUID REFERENCES libraries ON DELETE CASCADE,
  member_since TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Lending transactions table
CREATE TABLE IF NOT EXISTS lending_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  library_book_id UUID REFERENCES library_books ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES library_users NOT NULL,
  borrowed_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  returned_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Function to update availability on borrow/return
CREATE OR REPLACE FUNCTION update_library_book_availability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'borrowed' THEN
    UPDATE library_books SET is_available = FALSE WHERE id = NEW.library_book_id;
  ELSIF NEW.status = 'returned' THEN
    UPDATE library_books SET is_available = TRUE WHERE id = NEW.library_book_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for book availability
CREATE TRIGGER trg_update_availability
AFTER INSERT OR UPDATE ON lending_transactions
FOR EACH ROW
EXECUTE FUNCTION update_library_book_availability();

-- Function to mark overdue books
CREATE OR REPLACE FUNCTION check_overdue_books()
RETURNS void AS $$
BEGIN
  UPDATE lending_transactions
  SET status = 'overdue'
  WHERE status = 'borrowed' 
    AND due_date < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_compilers ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lending_transactions ENABLE ROW LEVEL SECURITY;

-- Policies

-- Books
CREATE POLICY "Anyone can view books" ON books FOR SELECT USING (true);
CREATE POLICY "Only admins can insert books" ON books FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Only admins can update books" ON books FOR UPDATE USING (
  EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Only admins can delete books" ON books FOR DELETE USING (
  EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);

-- Authors (view only for now)
CREATE POLICY "Anyone can view authors" ON authors FOR SELECT USING (true);

-- Book Authors / Compilers
CREATE POLICY "Anyone can view author links" ON book_authors FOR SELECT USING (true);
CREATE POLICY "Anyone can view compiler links" ON book_compilers FOR SELECT USING (true);

-- Libraries
CREATE POLICY "Anyone can view libraries" ON libraries FOR SELECT USING (true);
CREATE POLICY "Only admins can insert libraries" ON libraries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Only admins can update libraries" ON libraries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Only admins can delete libraries" ON libraries FOR DELETE USING (
  EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);

-- Library books
CREATE POLICY "Anyone can view library books" ON library_books FOR SELECT USING (true);
CREATE POLICY "Only admins can insert library books" ON library_books FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Only admins can update library books" ON library_books FOR UPDATE USING (
  EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Only admins can delete library books" ON library_books FOR DELETE USING (
  EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);

-- Library Users
CREATE POLICY "Users can view only their own profile or if admin" ON library_users FOR SELECT USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Users can update their own profile or if admin" ON library_users FOR UPDATE USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);

-- Lending Transactions
CREATE POLICY "Users can view their own transactions or if admin" ON lending_transactions FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Only admins can create lending transactions" ON lending_transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Only admins can update lending transactions" ON lending_transactions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM library_users WHERE id = auth.uid() AND is_admin = true)
);