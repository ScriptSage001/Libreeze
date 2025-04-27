-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------
-- Public users table (basic user profile)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  profile_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------
-- Libraries table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS libraries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------
-- Books table (centralized catalog)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS books (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  isbn VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  publisher VARCHAR(255),
  category VARCHAR(100),
  genre VARCHAR(100),
  published_on DATE,
  language VARCHAR(50),
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster ISBN lookups
CREATE INDEX idx_books_isbn ON books(isbn);

-- ----------------------------------------
-- Authors table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS authors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------
-- Book-Author junction table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS book_authors (
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES authors(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (book_id, author_id)
);

-- ----------------------------------------
-- Book-Compiler junction table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS book_compilers (
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES authors(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (book_id, author_id)
);

-- ----------------------------------------
-- Library Books (individual copies)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS library_books (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  library_id UUID REFERENCES libraries(id) ON DELETE CASCADE NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  location VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------
-- Library Users (library-specific metadata)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS library_users (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  library_id UUID REFERENCES libraries(id) ON DELETE CASCADE,
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,
  member_since TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, library_id)
);

-- ----------------------------------------
-- Lending Transactions
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS lending_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  library_book_id UUID REFERENCES library_books(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  borrowed_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  returned_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------
-- Functions & Triggers
-- ----------------------------------------

-- Update library book availability based on lending status
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

-- Trigger to update availability after lending changes
CREATE TRIGGER trg_update_availability
AFTER INSERT OR UPDATE ON lending_transactions
FOR EACH ROW
EXECUTE FUNCTION update_library_book_availability();

-- Mark overdue books function
CREATE OR REPLACE FUNCTION check_overdue_books()
RETURNS void AS $$
BEGIN
  UPDATE lending_transactions
  SET status = 'overdue'
  WHERE status = 'borrowed' 
    AND due_date < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------
-- Row Level Security (RLS)
-- ----------------------------------------

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_compilers ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lending_transactions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- Policies
-- ----------------------------------------

-- USERS table
CREATE POLICY "Users can view their own user profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- LIBRARIES table
CREATE POLICY "Anyone can view libraries" ON libraries
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create libraries" ON libraries
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can modify libraries" ON libraries
  FOR INSERT WITH CHECK (
    EXISTS (
		SELECT 1 FROM library_users 
		WHERE user_id = auth.uid() 
			AND library_id = id
			AND is_admin = TRUE
	)
  );
CREATE POLICY "Only admins can update libraries" ON libraries
  FOR UPDATE USING (
    EXISTS (
		SELECT 1 FROM library_users 
		WHERE user_id = auth.uid() 
			AND library_id = id
			AND is_admin = TRUE
	)
  );
CREATE POLICY "Only admins can delete libraries" ON libraries
  FOR DELETE USING (
    EXISTS (
		SELECT 1 FROM library_users 
		WHERE user_id = auth.uid() 
			AND library_id = id
			AND is_admin = TRUE
	)
  );

-- BOOKS table
CREATE POLICY "Anyone can view books" ON books
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert books" ON books
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM library_users WHERE user_id = auth.uid() AND is_admin = TRUE)
  );
CREATE POLICY "Only admins can update books" ON books
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM library_users WHERE user_id = auth.uid() AND is_admin = TRUE)
  );
CREATE POLICY "Only admins can delete books" ON books
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM library_users WHERE user_id = auth.uid() AND is_admin = TRUE)
  );

-- AUTHORS table
CREATE POLICY "Anyone can view authors" ON authors
  FOR SELECT USING (true);

-- BOOK_AUTHORS and BOOK_COMPILERS
CREATE POLICY "Anyone can view author/compiler links" ON book_authors
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view author/compiler links" ON book_compilers
  FOR SELECT USING (true);

-- LIBRARY_BOOKS
CREATE POLICY "Anyone can view library books" ON library_books
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify library books" ON library_books
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM library_users
      WHERE user_id = auth.uid()
        AND library_id = library_books.library_id
        AND is_admin = TRUE
    )
  );
CREATE POLICY "Only admins can update library books" ON library_books
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM library_users
      WHERE user_id = auth.uid()
        AND library_id = library_books.library_id
        AND is_admin = TRUE
    )
  );
CREATE POLICY "Only admins can delete library books" ON library_books
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM library_users
      WHERE user_id = auth.uid()
        AND library_id = library_books.library_id
        AND is_admin = TRUE
    )
  );

-- LENDING_TRANSACTIONS
CREATE POLICY "Users can view their own transactions or admins" ON lending_transactions
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM library_users WHERE user_id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Only admins can create lending transactions" ON lending_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM library_users
      JOIN library_books ON library_users.library_id = library_books.library_id
      WHERE library_books.id = library_book_id
        AND library_users.user_id = auth.uid()
        AND library_users.is_admin = TRUE
    )
  );

CREATE POLICY "Only admins can update lending transactions" ON lending_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM library_users
      JOIN library_books ON library_users.library_id = library_books.library_id
      WHERE library_books.id = library_book_id
        AND library_users.user_id = auth.uid()
        AND library_users.is_admin = TRUE
    )
  );