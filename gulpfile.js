/**
 *
 *
 * A variable to toggle whether or not to do minified version for production
 *
 *
 */
var config = {
	dev: false
};

/**
 *
 * Gulp and gulp modules
 * Edit this file accordingly for your workflow.
 * Commonly you'll need to update src and dest paths for each Task (don't forget the watch task)
 *
 *
 */
var gulp = require('gulp'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    plumber = require('gulp-plumber'),
    notify = require('gulp-notify'),
    livereload = require('gulp-livereload'),
		source = require('vinyl-source-stream'),
		browserify = require('browserify'),
		watchify = require('watchify'),
		streamify = require('gulp-streamify');

var browserifyObj = function() {
  return browserify({
    cache: {},
    packageCache: {},
    entries: ['./src/bit-get.js'],
    debug: true
  });
};

//browserify watcher
var watcher = watchify(browserifyObj());
/**
 *
 * JS Task
 *
 *
 *
 */
var bundleJS = function( bundle ){
	return bundle.bundle()
		.pipe(source('bit-git.js'))
		// Add transformation tasks to the pipeline here.
		.pipe(gulp.dest( 'dist/' ))
		.pipe(livereload())
		.pipe(rename('bit-get.min.js'))
    .pipe(streamify(uglify()))
    .pipe(gulp.dest( 'dist/' ));
}

gulp.task('js', bundleJS.bind(null, browserifyObj()));

/**
 *
 * Watch Task
 * Watching just for JS and SCSS changes
 *
 *
 */
gulp.task('watch', function() {
	//livereload
	livereload.listen();

	//bundle our JS right away
	bundleJS(watcher);

	//watch our JS with watchify
	watcher.on('update', bundleJS.bind(null, watcher));
});

/**
 *
 * Default Task
 * Watching just for JS and SCSS changes
 *
 *
 */
gulp.task('default', ['watch']);